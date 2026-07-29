export function getDashboardRecruitmentAccessState(params: {
  isAdmin: boolean;
  featureGatingEnabled: boolean;
  hasFeature: (feature: string) => boolean;
  recruitmentFeature: string;
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
