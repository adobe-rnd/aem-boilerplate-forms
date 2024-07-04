import { toClassName } from '../../../scripts/aem.js';
import { AUDIENCES as audiences } from '../../../scripts/scripts.js';

export const DEFAULT_OPTIONS = {
  audiencesDataAttribute: '_internal_audience',
  audiencesMetaTagPrefix: 'audience',
  audiencesQueryParameter: 'audience',
};

function getAudienceFromUrl() {
  const usp = new URLSearchParams(window.location.search);
  const forcedAudience = usp.has(DEFAULT_OPTIONS.audiencesQueryParameter)
    ? toClassName(usp.get(DEFAULT_OPTIONS.audiencesQueryParameter))
    : null;
  return forcedAudience;
}

export async function resolveAudiences() {
  if (!audiences || !Object.keys(audiences).length) {
    return null;
  }
  // If we have a forced audience set in the query parameters (typically for simulation purposes)
  // we check if it is applicable
  const forcedAudience = getAudienceFromUrl();
  if (forcedAudience) {
    return forcedAudience;
  }

  const applicableAudiences = [];
  const promises = Object.keys(audiences).reduce((acc, key) => {
    if (audiences[key] && typeof audiences[key] === 'function') {
      if (audiences[key]()) {
        acc.push(key);
      }
    }
    return acc;
  }, applicableAudiences);
  await Promise.all(promises);
  return applicableAudiences;
}
