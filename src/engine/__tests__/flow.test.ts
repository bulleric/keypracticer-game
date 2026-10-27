import { COMMANDS, type Command } from '../commands';
import { FLOW, type FlowState } from '../flow';

describe('no dead ends', () => {
  const states = Object.entries(FLOW) as [string, FlowState][];
  test.each(states)('%s has a main action, a way out and a hint', (_id, st) => {
    expect(st.hint.length).toBeGreaterThan(5);
    expect(st.title.length).toBeGreaterThan(0);
    // The main action is a sound command the state answers to, or a played note.
    if (st.primary === 'NOTE') expect(Object.keys(st.commands)).toHaveLength(0);
    else if (st.primary !== 'TAP') expect(st.commands[st.primary as Command]).toBeTruthy();
    // A way out: a command it answers to, or a named tap target.
    if (st.escape in COMMANDS) expect(st.commands[st.escape as Command]).toBeTruthy();
    else expect(st.escape.length).toBeGreaterThan(3);
  });
  test('states that wait for notes never listen for commands', () => {
    for (const st of Object.values(FLOW) as FlowState[]) if (st.primary === 'NOTE') expect(st.commands).toEqual({});
  });
});
