import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { STATUSES, STATUS_LABELS } from '../labels.js';
import { ChatIcon, CheckSquareIcon, GripIcon, PaperclipIcon } from './icons.jsx';
import { Avatars, DueDate, Labels, PriorityBadge } from './ui.jsx';

// Annonces pour les lecteurs d'écran pendant le glisser-déposer (clavier : Espace, flèches, Espace).
const accessibility = {
  screenReaderInstructions: {
    draggable:
      'Appuyez sur Espace pour saisir la tâche, déplacez-la avec les flèches, puis appuyez de nouveau sur Espace pour la déposer. Échap annule.',
  },
  announcements: {
    onDragStart: ({ active }) => `Tâche « ${active.data.current?.title} » saisie.`,
    onDragOver: ({ over }) => (over ? `Au-dessus de la colonne ${STATUS_LABELS[over.id]}.` : 'Hors des colonnes.'),
    onDragEnd: ({ over }) => (over ? `Tâche déposée dans ${STATUS_LABELS[over.id]}.` : 'Tâche relâchée hors des colonnes.'),
    onDragCancel: () => 'Déplacement annulé.',
  },
};

/** Tableau Kanban : glisser une carte dans une autre colonne change le statut de la tâche. */
export default function KanbanBoard({ tasks, subtasksByParent, canEdit, onOpen, onMove }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const [activeId, setActiveId] = useState(null);
  const activeTask = tasks.find((task) => task.id === activeId);

  function handleDragEnd({ active, over }) {
    setActiveId(null);
    const task = tasks.find((t) => t.id === active.id);
    if (task && over && over.id !== task.status) onMove(task, over.id);
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={accessibility}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="kanban">
        {STATUSES.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <Column key={status} status={status} count={columnTasks.length}>
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  subtasks={subtasksByParent.get(task.id) ?? []}
                  draggable={canEdit(task)}
                  onOpen={onOpen}
                />
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className={`task-card prio-${activeTask.priority} is-overlay`}>
            <p className="task-card-title">{activeTask.title}</p>
            <CardDetails task={activeTask} subtasks={subtasksByParent.get(activeTask.id) ?? []} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, count, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`kanban-column${isOver ? ' is-over' : ''}`} aria-labelledby={`colonne-${status}`}>
      <header className="kanban-column-header">
        <span className={`status-dot dot-${status}`} aria-hidden="true" />
        <h2 id={`colonne-${status}`}>{STATUS_LABELS[status]}</h2>
        <span className="count">{count}</span>
      </header>
      <div className="kanban-cards">{children}</div>
    </section>
  );
}

function TaskCard({ task, subtasks, draggable, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
    data: { title: task.title },
    attributes: { roleDescription: 'tâche déplaçable' },
  });

  return (
    <article ref={setNodeRef} className={`task-card prio-${task.priority}${isDragging ? ' is-dragging' : ''}`}>
      <div className="task-card-head">
        <button type="button" className="link-button task-card-title" onClick={() => onOpen(task)}>
          {task.title}
        </button>
        {draggable && (
          <button type="button" className="drag-handle" aria-label={`Déplacer « ${task.title} »`} {...attributes} {...listeners}>
            <GripIcon />
          </button>
        )}
      </div>
      <CardDetails task={task} subtasks={subtasks} />
    </article>
  );
}

function CardDetails({ task, subtasks }) {
  const done = subtasks.filter((s) => s.status === 'termine').length;
  // La priorité « moyenne » est la valeur par défaut : on ne l'affiche pas pour alléger la carte.
  const showPriority = task.priority !== 'moyenne';
  return (
    <>
      {(showPriority || task.labels.length > 0) && (
        <div className="task-card-tags">
          {showPriority && <PriorityBadge priority={task.priority} />}
          <Labels labels={task.labels} />
        </div>
      )}
      <div className="task-card-foot">
        <div className="task-card-meta">
          {task.due_date && <DueDate task={task} />}
          {subtasks.length > 0 && (
            <span className="meta-item" title="Sous-tâches terminées">
              <CheckSquareIcon className="inline-icon" />
              {done}/{subtasks.length}
              <span className="sr-only"> sous-tâches terminées</span>
            </span>
          )}
          {task.comment_count > 0 && (
            <span className="meta-item" title="Commentaires">
              <ChatIcon className="inline-icon" />
              {task.comment_count}
              <span className="sr-only"> commentaire{task.comment_count > 1 ? 's' : ''}</span>
            </span>
          )}
          {task.attachment_count > 0 && (
            <span className="meta-item" title="Pièces jointes">
              <PaperclipIcon className="inline-icon" />
              {task.attachment_count}
              <span className="sr-only"> pièce{task.attachment_count > 1 ? 's' : ''} jointe{task.attachment_count > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
        <Avatars people={task.assignees} emptyText="" />
      </div>
    </>
  );
}
