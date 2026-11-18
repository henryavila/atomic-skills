/**
 * Valid schema 1.0 flow documents for layout/draw tests.
 * Topology varies; no fixture is a clone of another.
 */

export function flowDoc({
  slug,
  title,
  scenario = `${title}.`,
  actor = 'Actor',
  actors,
  graph,
  machines,
}) {
  return {
    schemaVersion: '1.0',
    planSlug: slug,
    title,
    scenario,
    actor,
    audience: 'both',
    actors: actors || [
      { id: 'A', label: actor, kind: 'actor' },
      { id: 'S', label: 'System', kind: 'participant' },
    ],
    graph,
    machines: machines || defaultMachine(slug, title),
  };
}

function defaultMachine(slug, title) {
  const id = slug.replace(/-/g, '_').slice(0, 24) || 'm';
  return [
    {
      id,
      label: title,
      entry: 'open',
      nodes: {
        open: { label: 'Open' },
        done: { label: 'Done', terminal: true },
      },
      transitions: [
        {
          id: 'T_done',
          from: 'open',
          to: 'done',
          when: 'finishes',
          label: 'Finishes',
          effects: [],
        },
      ],
    },
  ];
}

export function linearChain() {
  return flowDoc({
    slug: 'linear-chain',
    title: 'Linear four-step chain',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Start request',
          who: 'Actor',
          messages: [{ from: 'A', to: 'S', text: 'Opens the form', async: false }],
          next: 'S2',
        },
        S2: {
          type: 'activity',
          label: 'Fill details',
          who: 'Actor',
          messages: [{ from: 'A', to: 'S', text: 'Submits details', async: false }],
          next: 'S3',
        },
        S3: {
          type: 'activity',
          label: 'Store record',
          who: 'System',
          messages: [{ from: 'S', to: 'S', text: 'Writes the row', async: false }],
          next: 'S4',
        },
        S4: {
          type: 'activity',
          label: 'Confirm',
          who: 'System',
          messages: [{ from: 'S', to: 'A', text: 'Shows confirmation', async: true }],
          next: 'end_ok',
        },
        end_ok: { type: 'end', label: 'Rejected fail error inválido sem funil' },
      },
    },
  });
}

export function xorThreeWay() {
  return flowDoc({
    slug: 'xor-three-way',
    title: 'Three exclusive outcomes',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Triage the ticket',
          who: 'Actor',
          messages: [{ from: 'A', to: 'S', text: 'Opens triage', async: false }],
          next: 'X1',
        },
        X1: {
          type: 'xor',
          label: 'Which queue?',
          who: 'Actor',
          question: 'Which queue should receive this ticket?',
          messages: [{ from: 'A', to: 'S', text: 'Picks a queue', async: false }],
          branches: [
            { id: 'X1.low', when: 'low', label: 'Low', next: 'end_low' },
            { id: 'X1.mid', when: 'mid', label: 'Medium', next: 'end_mid' },
            { id: 'X1.high', when: 'high', label: 'High', next: 'end_high' },
          ],
        },
        end_low: { type: 'end', label: 'Queued low' },
        end_mid: { type: 'end', label: 'Queued medium' },
        end_high: { type: 'end', label: 'Queued high' },
      },
    },
  });
}

export function andJoin() {
  return flowDoc({
    slug: 'and-join',
    title: 'Parallel review then merge',
    actors: [
      { id: 'A', label: 'Requester', kind: 'actor' },
      { id: 'L', label: 'Legal', kind: 'actor' },
      { id: 'F', label: 'Finance', kind: 'actor' },
      { id: 'S', label: 'System', kind: 'participant' },
    ],
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Submit pack',
          who: 'Requester',
          messages: [{ from: 'A', to: 'S', text: 'Sends the pack', async: false }],
          next: 'P1',
        },
        P1: {
          type: 'and',
          label: 'Review in parallel',
          branches: [
            { id: 'P1.legal', label: 'Legal', next: 'SL' },
            { id: 'P1.fin', label: 'Finance', next: 'SF' },
          ],
        },
        SL: {
          type: 'activity',
          label: 'Legal review',
          who: 'Legal',
          messages: [{ from: 'L', to: 'S', text: 'Records legal OK', async: false }],
          next: 'J1',
        },
        SF: {
          type: 'activity',
          label: 'Finance review',
          who: 'Finance',
          messages: [{ from: 'F', to: 'S', text: 'Records finance OK', async: false }],
          next: 'J1',
        },
        J1: {
          type: 'join',
          label: 'Both reviews in',
          of: 'P1',
          next: 'end_ok',
        },
        end_ok: { type: 'end', label: 'Approved' },
      },
    },
  });
}

export function nestedXor() {
  return flowDoc({
    slug: 'nested-xor',
    title: 'Nested exclusive gates',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Receive file',
          who: 'System',
          messages: [{ from: 'S', to: 'A', text: 'Asks for a file', async: true }],
          next: 'X1',
        },
        X1: {
          type: 'xor',
          label: 'File present?',
          question: 'Did the actor attach a file?',
          branches: [
            { id: 'X1.no', when: 'missing', label: 'Missing', next: 'end_no' },
            { id: 'X1.yes', when: 'present', label: 'Present', next: 'X2' },
          ],
        },
        X2: {
          type: 'xor',
          label: 'File valid?',
          question: 'Is the attached file valid?',
          branches: [
            { id: 'X2.bad', when: 'invalid', label: 'Invalid', next: 'end_bad' },
            { id: 'X2.ok', when: 'valid', label: 'Valid', next: 'end_ok' },
          ],
        },
        end_no: { type: 'end', label: 'No file' },
        end_bad: { type: 'end', label: 'Invalid file' },
        end_ok: { type: 'end', label: 'Accepted file' },
      },
    },
  });
}

export function eventAndSubprocess() {
  return flowDoc({
    slug: 'event-subprocess',
    title: 'Timer then named subprocess',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Schedule window',
          who: 'Actor',
          messages: [{ from: 'A', to: 'S', text: 'Books a window', async: false }],
          next: 'E1',
        },
        E1: {
          type: 'event',
          label: 'Wait 24h',
          kind: 'timer',
          messages: [{ from: 'S', to: 'A', text: 'Window opened', async: true }],
          next: 'P1',
        },
        P1: {
          type: 'subprocess',
          label: 'Collect signatures',
          ref: 'sign',
          next: 'end_ok',
        },
        end_ok: { type: 'end', label: 'Signed' },
      },
      subgraphs: {
        sign: {
          entry: 'G1',
          nodes: {
            G1: {
              type: 'activity',
              label: 'Inner collect',
              next: 'Gend',
            },
            Gend: { type: 'end', label: 'Inner done' },
          },
        },
      },
    },
  });
}

export function entryIsXor() {
  return flowDoc({
    slug: 'entry-is-xor',
    title: 'Decision at the door',
    graph: {
      entry: 'X0',
      nodes: {
        X0: {
          type: 'xor',
          label: 'Already known?',
          question: 'Is the actor already known?',
          branches: [
            { id: 'X0.yes', when: 'known', label: 'Known', next: 'end_ok' },
            { id: 'X0.no', when: 'new', label: 'New', next: 'end_new' },
          ],
        },
        end_ok: { type: 'end', label: 'Continue' },
        end_new: { type: 'end', label: 'Register first' },
      },
    },
  });
}

export function twoBackEdges() {
  return flowDoc({
    slug: 'two-back-edges',
    title: 'Two correction loops',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Draft',
          who: 'Actor',
          messages: [{ from: 'A', to: 'S', text: 'Saves a draft', async: false }],
          next: 'X1',
        },
        X1: {
          type: 'xor',
          label: 'Syntax ok?',
          question: 'Is the draft syntactically valid?',
          branches: [
            { id: 'X1.bad', when: 'syntax_bad', label: 'Syntax error', next: 'C1' },
            { id: 'X1.ok', when: 'syntax_ok', label: 'Syntax ok', next: 'X2' },
          ],
        },
        C1: {
          type: 'activity',
          label: 'Fix syntax',
          who: 'Actor',
          messages: [{ from: 'S', to: 'A', text: 'Shows syntax errors', async: true }],
          next: 'X1',
        },
        X2: {
          type: 'xor',
          label: 'Policy ok?',
          question: 'Does the draft pass policy?',
          branches: [
            { id: 'X2.bad', when: 'policy_bad', label: 'Policy error', next: 'C2' },
            { id: 'X2.ok', when: 'policy_ok', label: 'Policy ok', next: 'end_ok' },
          ],
        },
        C2: {
          type: 'activity',
          label: 'Fix policy',
          who: 'Actor',
          messages: [{ from: 'S', to: 'A', text: 'Shows policy errors', async: true }],
          next: 'X2',
        },
        end_ok: { type: 'end', label: 'Published' },
      },
    },
  });
}

export function machineDiamond() {
  return flowDoc({
    slug: 'machine-diamond',
    title: 'Diamond state machine',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Open case',
          messages: [{ from: 'A', to: 'S', text: 'Opens a case', async: false }],
          next: 'end_ok',
        },
        end_ok: { type: 'end', label: 'Filed' },
      },
    },
    machines: [
      {
        id: 'case',
        label: 'Case',
        entry: 'new',
        nodes: {
          new: { label: 'New' },
          legal: { label: 'Legal track' },
          finance: { label: 'Finance track' },
          closed: { label: 'Closed', terminal: true },
        },
        transitions: [
          {
            id: 'T_legal',
            from: 'new',
            to: 'legal',
            when: 'to_legal',
            label: 'Goes to legal',
            effects: [],
          },
          {
            id: 'T_fin',
            from: 'new',
            to: 'finance',
            when: 'to_finance',
            label: 'Goes to finance',
            effects: [],
          },
          {
            id: 'T_lclose',
            from: 'legal',
            to: 'closed',
            when: 'legal_done',
            label: 'Legal closes',
            effects: [{ kind: 'write', label: 'Stores legal memo', target: 'case' }],
          },
          {
            id: 'T_fclose',
            from: 'finance',
            to: 'closed',
            when: 'finance_done',
            label: 'Finance closes',
            effects: [{ kind: 'write', label: 'Stores finance memo', target: 'case' }],
          },
        ],
      },
    ],
  });
}

export function machineThreeLoops() {
  return flowDoc({
    slug: 'machine-three-loops',
    title: 'Three self-loops on one state',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Hold',
          messages: [{ from: 'A', to: 'S', text: 'Keeps the item', async: false }],
          next: 'end_ok',
        },
        end_ok: { type: 'end', label: 'Held' },
      },
    },
    machines: [
      {
        id: 'hold',
        label: 'Hold',
        entry: 'parked',
        nodes: {
          parked: { label: 'Parked' },
          done: { label: 'Released', terminal: true },
        },
        transitions: [
          {
            id: 'T_ping',
            from: 'parked',
            to: 'parked',
            when: 'ping',
            label: 'Ping',
            effects: [{ kind: 'notify', label: 'Nudges owner', target: 'A' }],
          },
          {
            id: 'T_note',
            from: 'parked',
            to: 'parked',
            when: 'note',
            label: 'Add note',
            effects: [{ kind: 'write', label: 'Appends a note', target: 'hold' }],
          },
          {
            id: 'T_snooze',
            from: 'parked',
            to: 'parked',
            when: 'snooze',
            label: 'Snooze',
            effects: [],
          },
          {
            id: 'T_go',
            from: 'parked',
            to: 'done',
            when: 'release',
            label: 'Release',
            effects: [],
          },
        ],
      },
    ],
  });
}

export function twoMachines() {
  return flowDoc({
    slug: 'two-machines',
    title: 'Two stacked machines',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Start both',
          messages: [{ from: 'A', to: 'S', text: 'Starts both tracks', async: false }],
          next: 'end_ok',
        },
        end_ok: { type: 'end', label: 'Started' },
      },
    },
    machines: [
      {
        id: 'alpha',
        label: 'Alpha',
        entry: 'a0',
        nodes: {
          a0: { label: 'Alpha open' },
          a1: { label: 'Alpha done', terminal: true },
        },
        transitions: [
          {
            id: 'Ta',
            from: 'a0',
            to: 'a1',
            when: 'a_done',
            label: 'Alpha finishes',
            effects: [],
          },
        ],
      },
      {
        id: 'beta',
        label: 'Beta',
        entry: 'b0',
        nodes: {
          b0: { label: 'Beta open' },
          b1: { label: 'Beta done', terminal: true },
        },
        transitions: [
          {
            id: 'Tb',
            from: 'b0',
            to: 'b1',
            when: 'b_done',
            label: 'Beta finishes',
            effects: [],
          },
        ],
      },
    ],
  });
}

export function fiveActors() {
  return flowDoc({
    slug: 'five-actors',
    title: 'Five-actor conversation',
    actors: [
      { id: 'A', label: 'Author', kind: 'actor' },
      { id: 'E', label: 'Editor', kind: 'actor' },
      { id: 'R', label: 'Reviewer', kind: 'actor' },
      { id: 'P', label: 'Publisher', kind: 'actor' },
      { id: 'S', label: 'System', kind: 'participant' },
    ],
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Handoff chain',
          messages: [
            { from: 'A', to: 'E', text: 'Sends draft', async: false },
            { from: 'E', to: 'R', text: 'Asks for review', async: false },
            { from: 'R', to: 'P', text: 'Approves', async: false },
            { from: 'P', to: 'S', text: 'Publishes', async: false },
            { from: 'S', to: 'A', text: 'Confirms live', async: true },
          ],
          next: 'end_ok',
        },
        end_ok: { type: 'end', label: 'Live' },
      },
    },
  });
}

export function machinePeerTerminals() {
  return flowDoc({
    slug: 'machine-peer-terminals',
    title: 'Two peer terminal states',
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Decide',
          messages: [{ from: 'A', to: 'S', text: 'Decides', async: false }],
          next: 'end_ok',
        },
        end_ok: { type: 'end', label: 'Decided' },
      },
    },
    machines: [
      {
        id: 'peer',
        label: 'Peer',
        entry: 'open',
        nodes: {
          open: { label: 'Open' },
          yes: { label: 'Accepted', terminal: true },
          no: { label: 'Rejected', terminal: true },
        },
        transitions: [
          {
            id: 'T_yes',
            from: 'open',
            to: 'yes',
            when: 'yes',
            label: 'Accepts',
            effects: [],
          },
          {
            id: 'T_no',
            from: 'open',
            to: 'no',
            when: 'no',
            label: 'Rejects',
            effects: [],
          },
        ],
      },
    ],
  });
}

export function ALL_FIXTURES() {
  return [
    linearChain(),
    xorThreeWay(),
    andJoin(),
    nestedXor(),
    eventAndSubprocess(),
    entryIsXor(),
    twoBackEdges(),
    machineDiamond(),
    machineThreeLoops(),
    twoMachines(),
    fiveActors(),
    machinePeerTerminals(),
  ];
}
