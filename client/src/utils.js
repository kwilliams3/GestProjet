/** Date du jour au format 'AAAA-MM-JJ' (heure locale). */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isOverdue(task) {
  return task.status !== 'termine' && Boolean(task.due_date) && task.due_date < todayISO();
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function formatDate(iso) {
  return iso ? dateFormat.format(new Date(`${iso}T00:00:00Z`)) : '—';
}

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const relativeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** « à l'instant », « il y a 5 minutes », « hier »… puis la date au-delà d'une semaine. */
export function formatRelative(iso) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86400) return relativeFormat.format(Math.round(seconds / 86400), 'day');
  return dateTimeFormat.format(new Date(iso));
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/** Texte sans accents ni majuscules, pour les comparaisons (« Échéance » → « echeance »). */
export function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export function formatBudget(value) {
  return value == null ? '—' : numberFormat.format(value);
}

export function percent(part, total) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** Couleur d'identité d'un projet (pastille, liseré) : toujours la même pour un même projet. */
export function projectColor(id) {
  return `var(--series-${((id - 1) % 8) + 1})`;
}

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export function todayLong() {
  const text = longDate.format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** « design, urgent , » → ['design', 'urgent'] */
export function parseLabels(text) {
  return [...new Set(text.split(',').map((label) => label.trim()).filter(Boolean))];
}

/** Sépare les tâches principales des sous-tâches (regroupées par tâche parente). */
export function groupTasks(tasks) {
  const topLevel = [];
  const subtasksByParent = new Map();
  for (const task of tasks) {
    if (task.parent_id) {
      if (!subtasksByParent.has(task.parent_id)) subtasksByParent.set(task.parent_id, []);
      subtasksByParent.get(task.parent_id).push(task);
    } else {
      topLevel.push(task);
    }
  }
  return { topLevel, subtasksByParent };
}
