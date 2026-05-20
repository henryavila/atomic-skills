/* global React, window, InitiativeHero, ExitGatesCard, StackPanel, TaskList,
   ParkedPanel, EmergedPanel, ReferencesPanel, OutputsPanel, NarrativeBody */

const { useState: useStateIV } = React;

const InitiativeView = ({ initiative, hashTask, onJumpToTask, onOpenAnnotation,
                          onJumpToBlocker, onJumpToCrossRef }) => {
  // Default expanded: the "here" task and any hashTask
  const defaultExpanded = {};
  const hereTask = initiative.tasks.find(t => t.here);
  if (hereTask) defaultExpanded[hereTask.id] = true;
  if (hashTask) defaultExpanded[hashTask] = true;

  // Persist across re-renders (SSE-driven updates shouldn't collapse open tasks)
  const [expanded, setExpanded] = useStateIV(defaultExpanded);
  const isDone = initiative.status === 'done';

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '20px 24px 80px',
      width: '100%', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <InitiativeHero initiative={initiative}
        onJumpToTask={onJumpToTask}
        onOpenAnnotation={onOpenAnnotation} />

      <ExitGatesCard gates={initiative.exitGates}
        onOpenAnnotation={onOpenAnnotation} />

      {/* Stack is only meaningful for active initiatives */}
      {!isDone && initiative.stack && initiative.stack.length > 0 && (
        <StackPanel stack={initiative.stack} />
      )}

      {isDone && initiative.outputs && (
        <OutputsPanel outputs={initiative.outputs} />
      )}

      <TaskList tasks={initiative.tasks}
        hashTask={hashTask}
        expanded={expanded}
        setExpanded={setExpanded}
        onJumpToBlocker={onJumpToBlocker}
        onJumpToCrossRef={onJumpToCrossRef}
        onOpenAnnotation={onOpenAnnotation} />

      {/* Side findings — always present, quiet when empty */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
      }}>
        <ParkedPanel items={initiative.parked || []} />
        <EmergedPanel items={initiative.emerged || []} />
      </div>

      <ReferencesPanel refs={initiative.references || []} />

      {/* Markdown body — only if present */}
      {initiative.body && <NarrativeBody markdown={initiative.body} />}
    </div>
  );
};

window.InitiativeView = InitiativeView;
