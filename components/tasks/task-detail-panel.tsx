"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import {
  X,
  Calendar as CalendarIcon,
  Trash2,
  Star,
  Check,
  Plus,
  ArrowRight,
  ListTodo,
  Clock,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTasksAppStore } from '@/stores/tasks-app-store';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const tasks = useTasksAppStore((s) => s.tasks);
  const task = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId]);
  const subtasks = useMemo(() => tasks.filter((t) => t.parent === taskId), [tasks, taskId]);
  const lists = useTasksAppStore((s) => s.lists);
  const updateTask = useTasksAppStore((s) => s.updateTask);
  const toggleTaskComplete = useTasksAppStore((s) => s.toggleTaskComplete);
  const toggleTaskStar = useTasksAppStore((s) => s.toggleTaskStar);
  const deleteTask = useTasksAppStore((s) => s.deleteTask);
  const createTask = useTasksAppStore((s) => s.createTask);

  const [title, setTitle] = useState(task?.title || '');
  const [notes, setNotes] = useState(task?.notes || '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { dialogProps, confirm } = useConfirmDialog();

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setNotes(task.notes || '');
    }
  }, [task?.id, task?.title, task?.notes]);

  const formattedDueDate = useMemo(() => {
    if (!task?.due) return null;
    try {
      const d = parseISO(task.due);
      if (Number.isNaN(d.getTime())) return task.due;
      return format(d, 'EEEE, MMMM d, yyyy');
    } catch {
      return task.due;
    }
  }, [task?.due]);

  const formattedUpdatedDate = useMemo(() => {
    if (!task?.updated) return null;
    try {
      const d = parseISO(task.updated);
      if (Number.isNaN(d.getTime())) return null;
      return format(d, 'MMM d, h:mm a');
    } catch {
      return null;
    }
  }, [task?.updated]);

  if (!task) return null;

  const isCompleted = task.status === 'completed';

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      void updateTask(task.id, { title: title.trim() });
    }
  };

  const handleNotesBlur = () => {
    if (notes !== (task.notes || '')) {
      void updateTask(task.id, { notes: notes.trim() });
    }
  };

  const handleListChange = (newListId: string) => {
    if (newListId !== task.listId) {
      void updateTask(task.id, { listId: newListId });
    }
  };

  const handleSetDueDate = (dateStr: string | null) => {
    void updateTask(task.id, { due: dateStr || undefined });
    setShowDatePicker(false);
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    await createTask({
      title: newSubtaskTitle.trim(),
      listId: task.listId,
      parent: task.id,
    });
    setNewSubtaskTitle('');
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete task',
      message: 'Are you sure you want to delete this task and all its subtasks?',
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (confirmed) {
      void deleteTask(task.id);
      onClose();
    }
  };

  return (
    <div className="w-full sm:w-96 flex flex-col h-full bg-card border-s border-border overflow-hidden shadow-lg animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          {/* List Selector Dropdown */}
          <select
            value={task.listId}
            onChange={(e) => handleListChange(e.target.value)}
            className="text-xs font-medium bg-muted/50 hover:bg-muted text-foreground border border-border/50 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[180px] truncate"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {/* Star Toggle */}
          <button
            type="button"
            onClick={() => void toggleTaskStar(task.id)}
            className={cn(
              'p-1.5 rounded-full hover:bg-muted transition-colors',
              task.starred ? 'text-amber-500' : 'text-muted-foreground'
            )}
            title={task.starred ? 'Unstar' : 'Star'}
          >
            <Star className={cn('w-4 h-4', task.starred && 'fill-amber-500')} />
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Close Panel */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Completion & Title */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => void toggleTaskComplete(task.id)}
            className={cn(
              'mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
              isCompleted
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-muted-foreground/50 hover:border-primary hover:bg-primary/10'
            )}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
          </button>

          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleBlur();
            }}
            placeholder="Task title"
            className={cn(
              'flex-1 text-base font-medium bg-transparent border-0 focus:outline-none focus:ring-0 p-0 text-foreground placeholder:text-muted-foreground',
              isCompleted && 'line-through text-muted-foreground'
            )}
          />
        </div>

        {/* Due Date & Time */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5" />
            Date & Time
          </label>

          <div className="relative">
            {task.due ? (
              <div className="flex items-center justify-between bg-muted/40 border border-border/60 rounded-md px-3 py-2 text-sm">
                <span className="font-medium text-foreground">
                  {formattedDueDate}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker((v) => !v)}
                    className="text-xs text-primary hover:underline px-1.5 py-0.5"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDueDate(null)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    title="Remove date"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDatePicker((v) => !v)}
                className="flex items-center gap-2 w-full text-start text-sm text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/50 border border-dashed border-border rounded-md px-3 py-2 transition-colors"
              >
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span>Add date/time</span>
              </button>
            )}

            {/* Quick Date Presets Dropdown */}
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-xl p-2 z-20 space-y-1">
                <button
                  type="button"
                  onClick={() => handleSetDueDate(new Date().toISOString())}
                  className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded hover:bg-muted text-foreground transition-colors"
                >
                  <span>Today</span>
                  <span className="text-muted-foreground">{format(new Date(), 'MMM d')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDueDate(addDays(new Date(), 1).toISOString())}
                  className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded hover:bg-muted text-foreground transition-colors"
                >
                  <span>Tomorrow</span>
                  <span className="text-muted-foreground">{format(addDays(new Date(), 1), 'MMM d')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDueDate(addDays(new Date(), 7).toISOString())}
                  className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded hover:bg-muted text-foreground transition-colors"
                >
                  <span>Next week</span>
                  <span className="text-muted-foreground">{format(addDays(new Date(), 7), 'MMM d')}</span>
                </button>
                <div className="pt-1 border-t border-border mt-1">
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value) {
                        const d = new Date(e.target.value);
                        handleSetDueDate(d.toISOString());
                      }
                    }}
                    className="w-full text-xs bg-muted/50 text-foreground border border-border/50 rounded px-2 py-1 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details / Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Details
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add details, notes, or links..."
            rows={4}
            className="w-full text-sm bg-muted/30 hover:bg-muted/50 focus:bg-background border border-border/60 rounded-md p-2.5 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-y"
          />
        </div>

        {/* Subtasks */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5" />
              Subtasks
            </span>
            {subtasks.length > 0 && (
              <span className="text-[11px] font-normal text-muted-foreground">
                {subtasks.filter((s) => s.status === 'completed').length}/{subtasks.length}
              </span>
            )}
          </label>

          {/* Subtasks List */}
          <div className="space-y-1">
            {subtasks.map((st) => (
              <div
                key={st.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 group/st text-sm"
              >
                <button
                  type="button"
                  onClick={() => void toggleTaskComplete(st.id)}
                  className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0',
                    st.status === 'completed'
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground/50 hover:border-primary'
                  )}
                >
                  {st.status === 'completed' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </button>
                <span
                  className={cn(
                    'flex-1 text-xs truncate',
                    st.status === 'completed' && 'line-through text-muted-foreground'
                  )}
                >
                  {st.title}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteTask(st.id)}
                  className="opacity-0 group-hover/st:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Subtask Input */}
          <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
            <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0 ms-1" />
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Add a subtask..."
              className="flex-1 text-xs bg-transparent border-0 focus:outline-none focus:ring-0 p-1 text-foreground placeholder:text-muted-foreground"
            />
            {newSubtaskTitle.trim() && (
              <Button type="submit" size="sm" variant="ghost" className="h-6 text-xs px-2">
                Add
              </Button>
            )}
          </form>
        </div>
      </div>

      {/* Footer Info */}
      {formattedUpdatedDate && (
        <div className="px-4 py-2 border-t border-border/50 text-[11px] text-muted-foreground shrink-0 bg-muted/10">
          Updated {formattedUpdatedDate}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
