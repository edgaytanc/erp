import { valueFor } from "../utils/reportUtils";

export function ReportSummary({ activeReport, reportData }) {
  return (
    <section className="reports-summary">
      {activeReport.summary.map(([label, key, type]) => (
        <article key={key}>
          <span>{label}</span>
          <strong>{valueFor(reportData?.summary, key, type)}</strong>
        </article>
      ))}
    </section>
  );
}
