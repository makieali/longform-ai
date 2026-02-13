import fs from 'node:fs/promises';
import path from 'node:path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  TableOfContents,
  StyleLevel,
} from 'docx';
import EPub from 'epub-gen-memory';
import PDFDocument from 'pdfkit';
import type { Book, ChapterContent } from '../packages/core/src/types.js';

export interface ExportResult {
  format: string;
  filePath: string;
  sizeBytes: number;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function chapterToHtml(chapter: ChapterContent): string {
  const paragraphs = chapter.content
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
  return paragraphs;
}

export class BookExporter {
  private book: Book;
  private slug: string;

  constructor(book: Book) {
    this.book = book;
    this.slug = slugify(book.title);
  }

  async exportAll(outputDir: string): Promise<ExportResult[]> {
    await fs.mkdir(outputDir, { recursive: true });
    const results: ExportResult[] = [];

    const exporters = [
      () => this.exportMarkdown(outputDir),
      () => this.exportDocx(outputDir),
      () => this.exportEpub(outputDir),
      () => this.exportPdf(outputDir),
    ];

    for (const exporter of exporters) {
      try {
        results.push(await exporter());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  Export error: ${message}`);
      }
    }

    // Write metadata.json
    const metadataPath = path.join(outputDir, 'metadata.json');
    await fs.writeFile(
      metadataPath,
      JSON.stringify(
        {
          title: this.book.title,
          totalWords: this.book.totalWords,
          totalCost: this.book.totalCost,
          chapters: this.book.chapters.length,
          contentType: this.book.metadata.contentType,
          generatedAt: this.book.metadata.generatedAt,
          models: this.book.metadata.models,
          exports: results,
        },
        null,
        2,
      ),
    );

    return results;
  }

  async exportMarkdown(outputDir: string): Promise<ExportResult> {
    const lines: string[] = [];
    lines.push(`# ${this.book.title}\n`);

    if (this.book.outline?.synopsis) {
      lines.push(`> ${this.book.outline.synopsis}\n`);
    }

    lines.push('---\n');
    lines.push('## Table of Contents\n');
    for (const ch of this.book.chapters) {
      lines.push(`- [Chapter ${ch.number}: ${ch.title}](#chapter-${ch.number})`);
    }
    lines.push('\n---\n');

    for (const ch of this.book.chapters) {
      lines.push(`## Chapter ${ch.number}: ${ch.title} {#chapter-${ch.number}}\n`);
      lines.push(ch.content);
      lines.push('\n---\n');
    }

    const filePath = path.join(outputDir, `${this.slug}.md`);
    const content = lines.join('\n');
    await fs.writeFile(filePath, content, 'utf-8');
    const stat = await fs.stat(filePath);
    return { format: 'markdown', filePath, sizeBytes: stat.size };
  }

  async exportDocx(outputDir: string): Promise<ExportResult> {
    const children: Paragraph[] = [];

    // Title page
    children.push(
      new Paragraph({
        text: this.book.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    if (this.book.outline?.synopsis) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: this.book.outline.synopsis, italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        }),
      );
    }

    // Page break after title
    children.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
    );

    // Table of contents
    children.push(
      new Paragraph({
        text: 'Table of Contents',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      }),
    );

    const tocField = new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-2',
      stylesWithLevels: [new StyleLevel('Heading1', 1), new StyleLevel('Heading2', 2)],
    });
    children.push(tocField as unknown as Paragraph);

    children.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
    );

    // Chapters
    for (const ch of this.book.chapters) {
      children.push(
        new Paragraph({
          text: `Chapter ${ch.number}: ${ch.title}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );

      const paragraphs = ch.content.split(/\n\n+/).filter(p => p.trim());
      for (const p of paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: p.trim() })],
            spacing: { after: 120 },
          }),
        );
      }

      // Page break between chapters (except last)
      if (ch.number < this.book.chapters.length) {
        children.push(
          new Paragraph({
            children: [new PageBreak()],
          }),
        );
      }
    }

    const doc = new Document({
      features: { updateFields: true },
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filePath = path.join(outputDir, `${this.slug}.docx`);
    await fs.writeFile(filePath, buffer);
    const stat = await fs.stat(filePath);
    return { format: 'docx', filePath, sizeBytes: stat.size };
  }

  async exportEpub(outputDir: string): Promise<ExportResult> {
    const chapters = this.book.chapters.map(ch => ({
      title: `Chapter ${ch.number}: ${ch.title}`,
      data: chapterToHtml(ch),
    }));

    const epubBuffer = await new EPub(
      {
        title: this.book.title,
        author: 'LongForm AI',
        description: this.book.outline?.synopsis ?? '',
        content: chapters,
      },
      // No cover image
    ).genEpub();

    const filePath = path.join(outputDir, `${this.slug}.epub`);
    await fs.writeFile(filePath, epubBuffer);
    const stat = await fs.stat(filePath);
    return { format: 'epub', filePath, sizeBytes: stat.size };
  }

  async exportPdf(outputDir: string): Promise<ExportResult> {
    const filePath = path.join(outputDir, `${this.slug}.pdf`);

    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        bufferPages: true,
        info: {
          Title: this.book.title,
          Author: 'LongForm AI',
          Creator: 'LongForm AI Pipeline',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await fs.writeFile(filePath, buffer);
          const stat = await fs.stat(filePath);
          resolve({ format: 'pdf', filePath, sizeBytes: stat.size });
        } catch (err) {
          reject(err);
        }
      });
      doc.on('error', reject);

      // Title page
      doc.fontSize(28).font('Helvetica-Bold');
      doc.text(this.book.title, { align: 'center' });
      doc.moveDown(2);

      if (this.book.outline?.synopsis) {
        doc.fontSize(12).font('Helvetica-Oblique');
        doc.text(this.book.outline.synopsis, { align: 'center' });
      }

      doc.moveDown(4);
      doc.fontSize(10).font('Helvetica');
      doc.text('Generated by LongForm AI', { align: 'center' });
      doc.text(new Date().toLocaleDateString(), { align: 'center' });

      // Table of Contents page
      doc.addPage();
      doc.fontSize(20).font('Helvetica-Bold');
      doc.text('Table of Contents', { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica');
      for (const ch of this.book.chapters) {
        doc.text(`Chapter ${ch.number}: ${ch.title}`, {
          indent: 20,
        });
        doc.moveDown(0.3);
      }

      // Chapters
      for (const ch of this.book.chapters) {
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold');
        doc.text(`Chapter ${ch.number}: ${ch.title}`);
        doc.moveDown(1);

        doc.fontSize(11).font('Helvetica');
        const paragraphs = ch.content.split(/\n\n+/).filter(p => p.trim());
        for (const p of paragraphs) {
          doc.text(p.trim(), { align: 'justify', lineGap: 4 });
          doc.moveDown(0.5);
        }
      }

      doc.end();
    });
  }
}
