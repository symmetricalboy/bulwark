"use client";

import { useMemo } from 'react';
import { format, parseISO, isBefore } from 'date-fns';
import { displayNow, isDisplayToday } from '@/lib/timezone';
import { Check, Star, Calendar as CalendarIcon, ChevronDown, ChevronRight, Plus, Trash2 } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { TaskItem } from '@/stores/tasks-app-store';
import { useTasksAppStore } from '@/stores/tasks-app-store';

interface TaskItemRowProps {
  task: TaskItem;
  isSelected?: boolean;
  onSelect?: () => void;
  subtasks?: TaskItem[];
  isSubtaskExpanded?: boolean;
  onToggleSubtaskExpand?: () => void;
  onAddSubtask?: (parentId: string) => void;
}

export function TaskItemRow({
  task,
  isSelected,
  onSelect,
  subtasks = [],
  isSubtaskExpanded,
  onToggleSubtaskExpand,
  onAddSubtask,
}: TaskItemRowProps) {
  const toggleTaskComplete = useTasksAppStore((s) => s.toggleTaskComplete);
  const toggleTaskStar = useTasksAppStore((s) => s.toggleTaskStar);
  const deleteTask = useTasksAppStore((s) => s.deleteTask);

  const isCompleted = task.status === 'completed';

  const dueDateInfo = useMemo(() => {
    if (!task.due) return null;
    try {
      const due = parseISO(task.due);
      if (Number.isNaN(due.getTime())) return null;

      const overdue = !isCompleted && isBefore(due, displayNow()) && !isDisplayToday(due);
      const isToday = isDisplayToday(due);

      let label = format(due, 'MMM d');
      if (isToday) label = 'Today';
      else if (overdue) label = `${format(due, 'MMM d')} (Overdue)`;

      return {
        label,
        overdue,
        isToday,
      };
    } catch {
      return null;
    }
  }, [task.due, isCompleted]);

  const completedSubtasksCount = subtasks.filter((s) => s.status === 'completed').length;

  return (
    <div className="group/task flex flex-col border-b border-border/40 transition-colors">
      <div
        onClick={onSelect}
        className={cn(
          'flex items-start gap-3 px-4 py-2.5 cursor-pointer rounded-lg transition-colors',
          isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/60',
          isCompleted && 'opacity-65'
        )}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void toggleTaskComplete(task.id);
          }}
          className={cn(
            'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
            isCompleted
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/50 hover:border-primary hover:bg-primary/10'
          )}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium leading-snug break-words truncate',
                isCompleted && 'line-through text-muted-foreground font-normal'
              )}
            >
              {task.title || 'Untitled task'}
            </span>
          </div>

          {/* Notes Preview */}
          {task.notes && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 break-words">
              {task.notes}
            </p>
          )}

          {/* Metadata: Due Date & Subtasks count */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {dueDateInfo && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium',
                  dueDateInfo.overdue
                    ? 'bg-destructive/15 text-destructive font-semibold'
                    : dueDateInfo.isToday
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <CalendarIcon className="w-3 h-3" />
                {dueDateInfo.label}
              </span>
            )}

            {subtasks.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSubtaskExpand?.();
                }}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-2 py-0.5 rounded-full transition-colors"
              >
                {isSubtaskExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>
                  {completedSubtasksCount}/{subtasks.length} subtasks
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Action icons (Star & Delete on hover) */}
        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/task:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleTaskStar(task.id);
            }}
            className={cn(
              'p-1.5 rounded-full hover:bg-muted transition-colors',
              task.starred ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-muted-foreground'
            )}
            title={task.starred ? 'Unstar' : 'Star'}
          >
            <Star className={cn('w-4 h-4', task.starred && 'fill-amber-500')} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void deleteTask(task.id);
            }}
            className="p-1.5 rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover/task:opacity-100"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Render Nested Subtasks if expanded */}
      {isSubtaskExpanded && subtasks.length > 0 && (
        <div className="ps-10 pe-4 pb-2 space-y-1">
          {subtasks.map((st) => (
            <div
              key={st.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.();
              }}
              className="flex items-center gap-2.5 py-1 px-2 rounded hover:bg-muted/40 text-xs text-muted-foreground group/subtask"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleTaskComplete(st.id);
                }}
                className={cn(
                  'w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all shrink-0',
                  st.status === 'completed'
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/40 hover:border-primary'
                )}
              >
                {st.status === 'completed' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </button>
              <span className={cn('flex-1 truncate', st.status === 'completed' && 'line-through opacity-70')}>
                {st.title}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteTask(st.id);
                }}
                className="opacity-0 group-hover/subtask:opacity-100 p-0.5 hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {onAddSubtask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubtask(task.id);
              }}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 py-1 px-2"
            >
              <Plus className="w-3 h-3" />
              Add subtask
            </button>
          )}
        </div>
      )}
    </div>
  );
}
