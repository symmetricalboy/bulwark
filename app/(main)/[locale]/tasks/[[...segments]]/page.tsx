import { TasksApp } from "@/components/tasks/tasks-app";
import { generateLiteSegmentParams } from "@/lib/lite-static-params";

// Tasks permalinks:
//   /tasks                        the stored view or active list
//   /tasks/<listId>               a specific task list
//   /tasks/<listId>/<taskId>      a specific task selected in the list
// Static Lite export: only the bare surface is prerendered; deep-link segments
// are read from the address bar in the browser (hooks/use-lite-link-segments.ts).
// `undefined` in the server build keeps the route dynamic (lib/lite-static-params.ts).
export const generateStaticParams = generateLiteSegmentParams;

export default async function TasksRoute({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  return <TasksApp linkSegments={segments ?? []} />;
}
