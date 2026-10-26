// Side panels. Each tab lives in its own module under ./panels/ and registers itself with
// registerPanel(); this file only loads them. To add a panel, create ./panels/foo.js and
// add an import line below (see ./panels/registry.js for the panel definition).
export { PANELS, TABS, registerPanel } from './panels/registry.js';
export { describeDemand } from './panels/common.js';

import './panels/realm.js';
import './panels/court.js';
import './panels/laws.js';
import './panels/focus.js';
import './panels/diplomacy.js';
import './panels/military.js';
import './panels/economy.js';
import './panels/wars.js';
import './panels/ledger.js';
