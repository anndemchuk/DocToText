const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const SLIDES_PER_BATCH = 5;

function decodeXmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&');
}

// Pulls out paragraph text from a slide/notes XML, without a full XML parser:
// each <a:p>...</a:p> becomes one paragraph, and every <a:t> run inside it is concatenated.
function extractParagraphs(xml) {
  const paragraphs = [];
  const paragraphRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  const textRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
  let pMatch;
  while ((pMatch = paragraphRegex.exec(xml)) !== null) {
    const inner = pMatch[1];
    let text = '';
    let tMatch;
    textRegex.lastIndex = 0;
    while ((tMatch = textRegex.exec(inner)) !== null) {
      text += decodeXmlEntities(tMatch[1]);
    }
    if (text.trim()) paragraphs.push(text);
  }
  return paragraphs;
}

function parseRelationships(xml) {
  const rels = {};
  const relRegex = /<Relationship\b[^>]*\/?>/g;
  let m;
  while ((m = relRegex.exec(xml)) !== null) {
    const tag = m[0];
    const id = /Id="([^"]+)"/.exec(tag);
    const type = /Type="([^"]+)"/.exec(tag);
    const target = /Target="([^"]+)"/.exec(tag);
    if (id) rels[id[1]] = { type: type ? type[1] : '', target: target ? target[1] : '' };
  }
  return rels;
}

function parseSlideOrder(presentationXml) {
  const ids = [];
  const sldIdRegex = /<p:sldId\b[^>]*\/?>/g;
  let m;
  while ((m = sldIdRegex.exec(presentationXml)) !== null) {
    const rid = /r:id="([^"]+)"/.exec(m[0]);
    if (rid) ids.push(rid[1]);
  }
  return ids;
}

async function readZipEntry(zip, zipPath) {
  const entry = zip.file(zipPath);
  if (!entry) return null;
  return entry.async('string');
}

// Reads slides in their real visual order (via presentation.xml + rels, not just
// filename order, since PowerPoint can reorder slides independently of file names),
// and pulls in speaker notes for each slide when present.
async function convertPptx(filePath, onProgress) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);

  const presentationXml = await readZipEntry(zip, 'ppt/presentation.xml');
  const presRelsXml = await readZipEntry(zip, 'ppt/_rels/presentation.xml.rels');
  if (!presentationXml || !presRelsXml) {
    throw new Error('This file does not look like a valid PPTX package.');
  }

  const slideOrderRids = parseSlideOrder(presentationXml);
  const presRels = parseRelationships(presRelsXml);

  const slideTargets = slideOrderRids
    .map((rid) => presRels[rid] && presRels[rid].target)
    .filter((target) => target && target.includes('slide'));

  const total = slideTargets.length;
  const slideBlocks = [];

  onProgress(0, total, `Starting extraction of ${total} slide${total === 1 ? '' : 's'}...`);

  for (let i = 0; i < slideTargets.length; i += 1) {
    const target = slideTargets[i]; // e.g. "slides/slide3.xml"
    const slidePath = `ppt/${target}`;
    const slideXml = await readZipEntry(zip, slidePath);
    const slideParagraphs = slideXml ? extractParagraphs(slideXml) : [];

    let notesParagraphs = [];
    const baseName = path.posix.basename(target);
    const relsPath = `ppt/slides/_rels/${baseName}.rels`;
    const relsXml = await readZipEntry(zip, relsPath);
    if (relsXml) {
      const rels = parseRelationships(relsXml);
      const notesRel = Object.values(rels).find((r) => r.type && r.type.includes('notesSlide'));
      if (notesRel) {
        const notesPath = path.posix.normalize(`ppt/slides/${notesRel.target}`);
        const notesXml = await readZipEntry(zip, notesPath);
        if (notesXml) notesParagraphs = extractParagraphs(notesXml);
      }
    }

    let block = `## Slide ${i + 1}\n\n${slideParagraphs.join('\n\n') || '*(no text on this slide)*'}`;
    if (notesParagraphs.length) {
      block += `\n\n**Speaker notes:** ${notesParagraphs.join(' ')}`;
    }
    slideBlocks.push(block);

    if ((i + 1) % SLIDES_PER_BATCH === 0 || i === slideTargets.length - 1) {
      onProgress(i + 1, total, `Extracted slide ${i + 1} of ${total}`);
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return { text: slideBlocks.join('\n\n'), warnings: [] };
}

module.exports = { convertPptx };
