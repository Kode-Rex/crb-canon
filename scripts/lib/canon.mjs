// Load and validate the Canon: canon.yml plus the Articles in articles/.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const roman = z.enum(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);

export const CanonSchema = z.object({
  founded: isoDate,
  observations: z
    .array(z.object({ text: z.string().min(1), status: z.enum(['HELD', 'CONTESTED', 'NO CANONICAL POSITION']) }).strict())
    .min(1),
  warnings: z.array(z.object({ title: z.string().min(1), text: z.string().min(1) }).strict()).min(1),
  amendments: z
    .array(
      z
        .object({
          version: z.string().regex(/^v\d+\.\d+\.\d+$/, 'expected vMAJOR.MINOR.PATCH'),
          id: z.string().regex(/^AMD-\d{4}$/, 'expected AMD-NNNN'),
          summary: z.string().min(1),
          date: isoDate,
        })
        .strict(),
    )
    .min(1),
});

export const ArticleSchema = z.object({
  order: z.number().int().min(1),
  num: roman,
  title: z.string().min(1),
  tenet: z.string().min(1),
  held: z.string().regex(/^v\d+\.\d+\.\d+$/),
  questions: z.array(z.string().min(1)).min(1),
  misreadings: z.array(z.string().min(1)).default([]),
});

/** Split a Markdown file into YAML frontmatter and body. */
export function splitFrontmatter(text, file) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing YAML frontmatter`);
  return { data: parse(m[1]), body: m[2].trim() };
}

function check(schema, value, where) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${where}${i.path.length ? '.' + i.path.join('.') : ''}: ${i.message}`);
    throw new Error(`Invalid Canon:\n${issues.join('\n')}`);
  }
  return result.data;
}

/** Everything the Church holds, validated. Throws with every problem listed. */
export function loadCanon(root) {
  const canon = check(CanonSchema, parse(readFileSync(join(root, 'canon.yml'), 'utf8')), 'canon.yml');
  const articles = readdirSync(join(root, 'articles'))
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const path = `articles/${file}`;
      const { data, body } = splitFrontmatter(readFileSync(join(root, path), 'utf8'), path);
      return { id: file.replace(/\.md$/, ''), path, data: check(ArticleSchema, data, path), body };
    })
    .sort((a, b) => a.data.order - b.data.order);

  const orders = articles.map((a) => a.data.order);
  if (new Set(orders).size !== orders.length) throw new Error('Invalid Canon: two Articles share an order');

  return { ...canon, version: canon.amendments[0].version, articles };
}
