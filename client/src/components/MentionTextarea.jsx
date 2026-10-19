import { useId, useRef, useState } from 'react';
import { normalize } from '../utils.js';

/**
 * Zone de texte avec suggestions de mentions : taper « @ » puis le début d'un nom.
 * Flèches pour choisir, Entrée ou Tab pour insérer, Échap pour fermer ; Ctrl+Entrée envoie.
 */
export default function MentionTextarea({ value, onChange, members, onSubmitShortcut, ...props }) {
  const ref = useRef(null);
  const listId = useId();
  const [mention, setMention] = useState(null); // { start: position du « @ », query }
  const [active, setActive] = useState(0);

  const suggestions = mention
    ? members.filter((m) => normalize(m.full_name).includes(normalize(mention.query))).slice(0, 6)
    : [];
  const showList = suggestions.length > 0;

  function detect(text, caret) {
    const before = text.slice(0, caret);
    const match = /(?:^|\s)@([^\s@][^@\n]{0,30})?$/u.exec(before);
    const query = match?.[1] ?? '';
    setMention(match ? { start: before.length - query.length - 1, query } : null);
    setActive(0);
  }

  function insert(member) {
    const caret = ref.current.selectionStart;
    const inserted = `@${member.full_name} `;
    onChange(value.slice(0, mention.start) + inserted + value.slice(caret));
    setMention(null);
    const position = mention.start + inserted.length;
    requestAnimationFrame(() => {
      ref.current.focus();
      ref.current.setSelectionRange(position, position);
    });
  }

  function handleKeyDown(event) {
    if (showList) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((a) => (a + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insert(suggestions[active]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault(); // ne ferme pas la fenêtre modale
        setMention(null);
        return;
      }
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmitShortcut?.();
    }
  }

  return (
    <div className="mention-box">
      <textarea
        ref={ref}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          detect(event.target.value, event.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setMention(null)}
        {...props}
      />
      <ul id={listId} role="listbox" className="card mention-list" hidden={!showList}>
        {suggestions.map((member, i) => (
          <li
            key={member.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={i === active ? 'active' : undefined}
            onMouseDown={(event) => {
              event.preventDefault(); // garde le focus dans la zone de texte
              insert(member);
            }}
          >
            {member.full_name}
          </li>
        ))}
      </ul>
    </div>
  );
}
