// ---------------------------------------------------------------------------
// Chart image builders (QuickChart)
// ---------------------------------------------------------------------------
// Slack's native `data_visualization` block is not yet available in all
// workspaces (publish fails with "unsupported type: data_visualization"), so
// charts are rendered as `image` blocks pointing at a QuickChart.io PNG — a
// Chart.js config encoded in the URL. Universally supported, no hosting needed.
// https://quickchart.io/documentation/
// ---------------------------------------------------------------------------

const QUICKCHART_BASE = "https://quickchart.io/chart";

// TP brand palette — first color is the primary violet; rest for multi-series.
const PALETTE = [
  "rgb(124, 58, 237)", // violet
  "rgb(37, 99, 235)",  // blue
  "rgb(13, 148, 136)", // teal
  "rgb(234, 88, 12)",  // orange
  "rgb(219, 39, 119)", // pink
  "rgb(74, 74, 106)",  // slate
];
function fill(rgb) { return rgb.replace("rgb", "rgba").replace(")", ", 0.15)"); }

// Build a QuickChart URL from a Chart.js config object.
function chartUrl(config, { width = 720, height = 320, background = "white" } = {}) {
  const c = encodeURIComponent(JSON.stringify(config));
  return `${QUICKCHART_BASE}?w=${width}&h=${height}&bkg=${encodeURIComponent(background)}&c=${c}`;
}

// Normalize a spec into an array of series: [{ label, values, dashed? }].
function toSeries(spec) {
  if (Array.isArray(spec.datasets) && spec.datasets.length) return spec.datasets;
  return [{ label: spec.label, values: spec.values }];
}

// Full chart title (metric name + unit) for image rendering.
function fullTitle(spec) {
  const unit = spec.unit ? ` (${spec.unit})` : "";
  return `${spec.label}${unit}`;
}

function lineUrl(spec) {
  const series = toSeries(spec);
  // "area" fills under every solid series; plain "line" only fills a single series.
  const isArea = spec.type === "area";
  const options = {
    title: { display: true, text: fullTitle(spec), fontSize: 15 },
    legend: { display: series.length > 1 || Boolean(spec.showLegend), position: "top" },
    scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
  };

  // Breach zone: shade the region above the threshold red and label the line.
  if (spec.breachZone) {
    options.annotation = {
      annotations: [
        {
          type: "box",
          yScaleID: "y-axis-0",
          yMin: spec.breachZone.min,
          backgroundColor: "rgba(220, 38, 38, 0.10)",
          borderColor: "rgba(220, 38, 38, 0.0)",
        },
        {
          type: "line",
          mode: "horizontal",
          scaleID: "y-axis-0",
          value: spec.breachZone.min,
          borderColor: "rgb(37, 99, 235)",
          borderWidth: 2,
          borderDash: [6, 4],
          label: {
            enabled: true,
            content: spec.breachZone.label,
            position: "left",
            backgroundColor: "rgb(37, 99, 235)",
            fontSize: 10,
          },
        },
      ],
    };
  }

  return chartUrl({
    type: "line",
    data: {
      labels: spec.labels,
      datasets: series.map((s, i) => {
        const color = s.color || PALETTE[i % PALETTE.length];
        const shouldFill = !s.dashed && (isArea || series.length === 1);
        return {
          label: s.label,
          data: s.values,
          borderColor: color,
          backgroundColor: shouldFill ? fill(color) : "transparent",
          borderWidth: s.dashed ? 2 : 3,
          borderDash: s.dashed ? [6, 4] : undefined,
          pointRadius: s.dashed ? 0 : 4,
          pointBackgroundColor: color,
          fill: shouldFill,
          tension: 0.35,
          // Print the value on each real data point (not the flat threshold).
          datalabels: s.dashed
            ? { display: false }
            : { align: "top", color, backgroundColor: "white", borderRadius: 3, font: { size: 10, weight: "bold" }, padding: 2 },
        };
      }),
    },
    options,
  });
}

function barUrl(spec) {
  const series = toSeries(spec);
  return chartUrl({
    type: "bar",
    data: {
      labels: spec.labels,
      datasets: series.map((s, i) => {
        const color = s.color || PALETTE[i % PALETTE.length];
        return { label: s.label, data: s.values, backgroundColor: color, borderColor: color, borderWidth: 1 };
      }),
    },
    options: {
      title: { display: true, text: fullTitle(spec), fontSize: 15 },
      legend: { display: series.length > 1 || Boolean(spec.showLegend), position: "top" },
      scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
    },
  });
}

// Return an `image` block for a chart spec.
// spec: { type, label, labels, values, unit, datasets?: [{label, values, dashed?}] }
function buildChartImageBlock(spec) {
  if (!spec) return null;
  const unit = spec.unit ? ` (${spec.unit})` : "";
  const label = `${spec.label}${unit}`;
  // "area" renders as a filled line chart.
  const url = spec.type === "bar" ? barUrl(spec) : lineUrl(spec);
  return { type: "image", image_url: url, alt_text: label };
}

// Native data_visualization block for a chart spec.
// Supported in messages (not App Home). Constraints: title ≤50, series name ≤20,
// up to 12 series. Accepts single-series ({label, values}) or multi ({datasets}).
// https://docs.slack.dev/reference/block-kit/blocks/data-visualization-block/
// Trim to a max length on a word boundary (avoids "…sentiment s" cut-offs).
function clampWords(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

function buildChartVizBlock(spec) {
  if (!spec) return null;
  const unit = spec.unit ? ` (${spec.unit})` : "";
  const title = clampWords(`${spec.label}${unit}`, 50);

  // Pie charts use `segments` (label + value), not series/axis_config.
  if (spec.type === "pie") {
    return {
      type: "data_visualization",
      title,
      chart: {
        type: "pie",
        segments: spec.labels.map((l, i) => ({ label: String(l), value: spec.values[i] })),
      },
    };
  }

  // data_visualization also supports line / bar / area.
  const chartType = ["bar", "area"].includes(spec.type) ? spec.type : "line";
  const series = toSeries(spec).map((s) => ({
    name: clampWords(String(s.label), 20),
    data: spec.labels.map((l, i) => ({ label: String(l), value: s.values[i] })),
  }));
  return {
    type: "data_visualization",
    title,
    chart: {
      type: chartType,
      series,
      axis_config: {
        categories: spec.labels.map(String),
        x_label: "",
        y_label: spec.unit || "",
      },
    },
  };
}

module.exports = { chartUrl, lineUrl, barUrl, buildChartImageBlock, buildChartVizBlock };
