import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardRecruitmentAccessState } from './dashboard-feature-access.ts';

test('recruitment queries and sections are disabled when entitlement is absent', () => {
  const state = getDashboardRecruitmentAccessState({
    isAdmin: true,
    featureGatingEnabled: true,
    hasFeature: (feature) => {
      assert.equal(feature, 'RECRUITMENT');
      return false;
    },
    recruitmentFeature: 'RECRUITMENT',
  });

  assert.equal(state.canAccessRecruitment, false);
  assert.equal(state.recruitmentQueriesEnabled, false);
  assert.equal(state.showRecruitmentCallToAction, false);
  assert.equal(state.showRecruitmentSections, false);
  assert.equal(state.includeOpenRolesCard, false);
});

test('recruitment queries remain disabled for non-admin members', () => {
  const state = getDashboardRecruitmentAccessState({
    isAdmin: false,
    featureGatingEnabled: false,
    hasFeature: () => true,
    recruitmentFeature: 'RECRUITMENT',
  });

  assert.equal(state.canAccessRecruitment, true);
  assert.equal(state.recruitmentQueriesEnabled, false);
  assert.equal(state.showRecruitmentCallToAction, false);
});
