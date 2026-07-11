const WEEKDAYS = [
  'søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag',
];

const MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

export function parseServerDate(value: string): Date {
  // Server sends "YYYY-MM-DD HH:MM:SS"; make it ISO-parseable.
  return new Date(value.replace(' ', 'T'));
}

export function formatDanishDateHeader(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${weekday} den ${day}. ${month} ${year}`;
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export interface DateSection<T> {
  key: string;
  title: string;
  data: T[];
}

/**
 * Groups items (newest first) into per-day sections, sorted newest-day-first.
 */
export function groupByDay<T>(
  items: T[],
  getDate: (item: T) => Date,
): DateSection<T>[] {
  const sorted = [...items].sort(
    (a, b) => getDate(b).getTime() - getDate(a).getTime(),
  );

  const sections: DateSection<T>[] = [];
  for (const item of sorted) {
    const date = getDate(item);
    const key = dayKey(date);
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.data.push(item);
    } else {
      sections.push({ key, title: formatDanishDateHeader(date), data: [item] });
    }
  }
  return sections;
}

/** Chunks each section's items into rows of `columns` for grid rendering inside a SectionList. */
export function chunkSections<T>(
  sections: DateSection<T>[],
  columns: number,
): DateSection<T[]>[] {
  return sections.map(section => {
    const rows: T[][] = [];
    for (let i = 0; i < section.data.length; i += columns) {
      rows.push(section.data.slice(i, i + columns));
    }
    return { key: section.key, title: section.title, data: rows };
  });
}
