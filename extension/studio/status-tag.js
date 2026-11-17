export const STATUS_ICONS={
  applied:'M9 12l2 2 4-4M4 3h16v18H4z',
  screen:'M4 5h16v14H4zM8 9h8M8 13h5',
  interview:'M3 5h12v14H3zM15 9l6-3v12l-6-3',
  upcoming:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  pending:'M8 3h8M8 21h8M8 3v5l8 8v5M16 3v5l-8 8v5',
  passed:'M5 12l4 4L19 6',
  offer:'m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z',
  failed:'M6 6l12 12M18 6 6 18',
  rejected:'M6 6l12 12M18 6 6 18',
  archived:'M6 6l12 12M18 6 6 18',
  needs_action:'M12 8v5M12 16v1M12 3 2 21h20z',
  rescheduled:'M3 11a9 9 0 1 1 3 8M3 4v7h7M12 8v4l3 2'
};
export function createStatusTag(React){
  const h=React.createElement;
  return function StatusTag({status,label,className='record-status-tag',...props}){
    return h('span',{...props,className,'data-result':status},
      h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:STATUS_ICONS[status]||STATUS_ICONS.pending})),label);
  };
}
