import TaskList from '@tiptap/extension-task-list'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'

function TaskListView() {
  return (
    <NodeViewWrapper className="note-todo">
      <NodeViewContent<'ul'> as="ul" data-type="taskList" />
    </NodeViewWrapper>
  )
}

/** TaskList with the block-level wrapper (no progress bar). */
export const TaskListWithProgress = TaskList.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TaskListView)
  },
})
