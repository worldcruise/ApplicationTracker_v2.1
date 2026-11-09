export function createMeetingsBoardPage(React, { Board }) {
  const h = React.createElement;
  return function MeetingsBoardPage() {
    return h('section', { className: 'meetings-page', 'aria-labelledby': 'meetings-title' },
      h('header', { className: 'meetings-heading' }, h('div', null,
        h('span', { className: 'web-eyebrow' }, 'Application pipeline'),
        h('h1', { id: 'meetings-title' }, 'Meetings'),
        h('p', null, 'Track screening, interviews, offers and application outcomes.'))),
      h('div', { className: 'meetings-application-board' }, h(Board)));
  };
}
