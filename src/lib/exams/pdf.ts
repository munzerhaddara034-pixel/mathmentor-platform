function escapePdf(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "?");
}

function wrapLine(text: string, width = 92) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function buildSimplePdf(title: string, bodyLines: string[]) {
  const pages: string[][] = [];
  let page: string[] = [];
  const push = (line: string) => {
    for (const chunk of wrapLine(line)) {
      if (page.length >= 52) {
        pages.push(page);
        page = [];
      }
      page.push(chunk);
    }
  };
  push(title);
  push("");
  for (const line of bodyLines) push(line);
  if (page.length) pages.push(page);
  if (!pages.length) pages.push([title]);

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds: number[] = [];
  let nextId = 3;
  const pageObjectIds: number[] = [];
  const contentIds: number[] = [];

  for (let i = 0; i < pages.length; i += 1) {
    pageObjectIds.push(nextId++);
    contentIds.push(nextId++);
  }

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pages.length} >>`);

  const slots: { id: number; body: string }[] = [
    { id: 1, body: objects[0] },
    { id: 2, body: objects[1] },
  ];

  pages.forEach((lines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentIds[index];
    slots.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`,
    });
    let y = 750;
    const commands = ["BT", "/F1 11 Tf", "14 TL"];
    commands.push(`1 0 0 1 48 ${y} Tm`);
    for (const line of lines) {
      commands.push(`(${escapePdf(line)}) Tj`);
      commands.push("T*");
      y -= 14;
    }
    commands.push("ET");
    const stream = commands.join("\n");
    slots.push({
      id: contentId,
      body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    });
  });

  slots.sort((a, b) => a.id - b.id);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const slot of slots) {
    offsets[slot.id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${slot.id} 0 obj\n${slot.body}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${slots.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= slots.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${slots.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export function examReportLines(input: {
  studentName: string;
  studentPhone: string;
  paperTitle: string;
  track: string;
  createdAt: string;
  grading: { totalAwarded: number; totalMax: number; percent: number; source: string; summary: string; subs: { label: string; awarded: number; max: number; comment: string }[] };
}) {
  const lines = [
    "MathMentor  Academy Munzer Haddara  /  Prof. Munzer Haddara",
    "Official exam simulation — Bareme report",
    `Student: ${input.studentName}  Phone: ${input.studentPhone}`,
    `Paper: ${input.paperTitle}  (${input.track})`,
    `Submitted: ${input.createdAt}`,
    `Source: ${input.grading.source} grader`,
    "",
    `TOTAL  ${input.grading.totalAwarded} / ${input.grading.totalMax}   (${input.grading.percent}%)`,
    input.grading.summary,
    "",
    "Marks breakdown",
  ];
  for (const sub of input.grading.subs) {
    lines.push(`  ${sub.label}:  ${sub.awarded} / ${sub.max}   ${sub.comment}`);
  }
  lines.push("", "This demo report uses a Lebanese-style per sub-question bareme.");
  return lines;
}
