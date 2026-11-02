// THE ONE SWITCH for every signup / booking form on rexaffects.com (/beta, /live, /links).
//
// endpoint: the store server's list API (POST JSON). A form may override it with its own
//           data-endpoint attribute, but leave those empty so this file stays the single source.
// live:     false = every form shows "opens soon" and sends nothing.
//           Flip to true ONLY after the endpoint is confirmed deployed and answering.
//
// Local review without the server: add ?formtest=ok or ?formtest=error to any page URL to see the
// success / error states (nothing is sent).
window.RA_LIST = {
  endpoint: 'https://rexaffects-store.vercel.app/api/list',
  live: false
};
