import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Trial } from '../types/trial';
import type { MatchResult, CriterionMatch } from '../types/matching';

const STATUS_LABEL: Record<string, string> = {
  ELIGIBLE: 'Eligible',
  NEEDS_REVIEW: 'Needs Review',
  INELIGIBLE: 'Ineligible',
};

const RESULT_LABEL: Record<string, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  MISSING: 'Review',
};

const STATUS_COLOR: Record<string, [number, number, number]> = {
  ELIGIBLE: [22, 163, 74],
  NEEDS_REVIEW: [217, 119, 6],
  INELIGIBLE: [220, 38, 38],
};

function reasonFor(c: CriterionMatch): string {
  const base = `${c.type === 'inclusion' ? 'Inclusion' : 'Exclusion'} criterion "${c.label}" requires ${c.required}; patient value is ${c.patientValue || 'not on record'}.`;
  const outcome =
    c.result === 'PASS'
      ? ' Criterion satisfied.'
      : c.result === 'FAIL'
      ? ' Criterion not satisfied — patient does not meet this requirement.'
      : ' Insufficient data to confirm this criterion; flagged for manual review.';
  const evidence = c.source ? ` Evidence: ${c.source}.` : '';
  return base + outcome + evidence;
}

export function exportTrialDocumentation(trial: Trial, results: MatchResult[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Trial Screening Documentation', margin, 50);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, margin, 66);

  doc.setDrawColor(220);
  doc.line(margin, 76, pageWidth - margin, 76);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${trial.ctriId} — ${trial.title}`, margin, 96);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  const metaLines = [
    `Sponsor: ${trial.sponsor}    Phase: ${trial.phase}    Status: ${trial.status}`,
    `Locations: ${trial.locations.join(', ')}`,
    `Condition: ${trial.condition}`,
  ];
  metaLines.forEach((line, i) => doc.text(line, margin, 112 + i * 13));

  const counts = {
    ELIGIBLE: results.filter(r => r.status === 'ELIGIBLE').length,
    NEEDS_REVIEW: results.filter(r => r.status === 'NEEDS_REVIEW').length,
    INELIGIBLE: results.filter(r => r.status === 'INELIGIBLE').length,
  };
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Summary: ${results.length} patients screened — ${counts.ELIGIBLE} eligible, ${counts.NEEDS_REVIEW} needs review, ${counts.INELIGIBLE} ineligible`,
    margin,
    112 + metaLines.length * 13 + 10
  );

  let cursorY = 112 + metaLines.length * 13 + 26;

  results.forEach((r, idx) => {
    if (cursorY > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      cursorY = 50;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${idx + 1}. Patient ${r.patientId}`, margin, cursorY);

    const color = STATUS_COLOR[r.status] ?? [90, 90, 90];
    doc.setTextColor(...color);
    doc.text(STATUS_LABEL[r.status] ?? r.status, pageWidth - margin, cursorY, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    cursorY += 14;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Inclusion met: ${r.inclusionMet}/${r.inclusionTotal}    Exclusion met: ${r.exclusionMet}/${r.exclusionTotal}`,
      margin,
      cursorY
    );
    cursorY += 10;

    const body = r.criteria.map(c => [
      c.type === 'inclusion' ? 'Inclusion' : 'Exclusion',
      c.label,
      c.required,
      c.patientValue || '—',
      RESULT_LABEL[c.result] ?? c.result,
      reasonFor(c),
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['Type', 'Criterion', 'Required', 'Patient Value', 'Result', 'Reasoning / Evidence']],
      body,
      styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 70 },
        2: { cellWidth: 60 },
        3: { cellWidth: 55 },
        4: { cellWidth: 40 },
        5: { cellWidth: 'auto' },
      },
      didParseCell: hook => {
        if (hook.section === 'body' && hook.column.index === 4) {
          const val = hook.cell.raw as string;
          if (val === 'Pass') hook.cell.styles.textColor = [22, 163, 74];
          else if (val === 'Fail') hook.cell.styles.textColor = [220, 38, 38];
          else if (val === 'Review') hook.cell.styles.textColor = [217, 119, 6];
        }
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 22;
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${p} of ${pageCount} — ${trial.ctriId} Screening Documentation`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'center' }
    );
  }

  doc.save(`${trial.ctriId}_screening_documentation.pdf`);
}
