import { describe, expect, it } from 'vitest';
import { buildSamplePipeline } from '@/core/sample-leads';
import { droppedLead, DRAG_TYPE } from './board-drop';

const leads = buildSamplePipeline(new Date('2026-11-16T09:00:00Z'));
const lead = leads[0]!;

describe('a drop on a Board column', () => {
  it('moves a tile from this Board to another column', () => {
    expect(droppedLead([DRAG_TYPE], lead.key, leads, 'replied')).toBe(lead);
  });

  it('ignores text, links and files dragged in from elsewhere', () => {
    expect(droppedLead(['text/plain'], lead.key, leads, 'replied')).toBeNull();
    expect(droppedLead(['text/uri-list', 'text/html'], 'https://elsewhere.example', leads, 'replied')).toBeNull();
    expect(droppedLead(['Files'], '', leads, 'replied')).toBeNull();
  });

  it('ignores a key that is not a saved lead', () => {
    expect(droppedLead([DRAG_TYPE], 'https://made-up.example|nobody', leads, 'replied')).toBeNull();
    expect(droppedLead([DRAG_TYPE], '', leads, 'replied')).toBeNull();
  });

  it("does nothing on the lead's own column", () => {
    expect(droppedLead([DRAG_TYPE], lead.key, leads, lead.status)).toBeNull();
  });
});
