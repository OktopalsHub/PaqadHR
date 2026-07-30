export function getDashboardRecruitmentAccessState<TFeature extends string>(params: {
  isAdmin: boolean;
  featureGatingEnabled: boolean;
  hasFeature: (feature: TFeature) => boolean;
  recruitmentFeature: TFeature;
}) {
  const canAccessRecruitment =
    !params.featureGatingEnabled || params.hasFeature(params.recruitmentFeature);
  const recruitmentQueriesEnabled = params.isAdmin && canAccessRecruitment;

  return {
    canAccessRecruitment,
    recruitmentQueriesEnabled,
    showRecruitmentCallToAction: recruitmentQueriesEnabled,
    showRecruitmentSections: recruitmentQueriesEnabled,
    includeOpenRolesCard: recruitmentQueriesEnabled,
  };
}
