import { Fragment } from 'react';
import { Avatars, DueDate, EmptyState, Labels, PriorityBadge, StatusBadge } from './ui.jsx';

/** Vue liste : tâches principales suivies de leurs sous-tâches. */
export default function TaskList({ tasks, subtasksByParent, onOpen }) {
  if (tasks.length === 0) return <EmptyState>Aucune tâche pour l'instant.</EmptyState>;

  return (
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Tâche</th>
            <th scope="col">Statut</th>
            <th scope="col">Priorité</th>
            <th scope="col">Échéance</th>
            <th scope="col">Assignée à</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <Fragment key={task.id}>
              <TaskRow task={task} onOpen={onOpen} />
              {(subtasksByParent.get(task.id) ?? []).map((subtask) => (
                <TaskRow key={subtask.id} task={subtask} onOpen={onOpen} isSubtask />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({ task, isSubtask = false, onOpen }) {
  return (
    <tr className={isSubtask ? 'subtask-row' : undefined}>
      <td>
        <button type="button" className="link-button" onClick={() => onOpen(task)}>
          {isSubtask && (
            <>
              <span aria-hidden="true">↳ </span>
              <span className="sr-only">Sous-tâche : </span>
            </>
          )}
          {task.title}
        </button>
        <Labels labels={task.labels} />
      </td>
      <td>
        <StatusBadge status={task.status} />
      </td>
      <td>
        <PriorityBadge priority={task.priority} />
      </td>
      <td>
        <DueDate task={task} />
      </td>
      <td>
        <Avatars people={task.assignees} />
      </td>
    </tr>
  );
}
