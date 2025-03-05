import { getTimeForQueries } from '../components/QueriesVsTime.jsx';

// Calculate expected annual fatalities based on success probability and other factors
export const calculateExpectedAnnualFatalities = (
  successProbabilityGivenEffort,
  expectedAnnualAttempts,
  expectedFatalitiesPerSuccessfulAttempt
) => {
  // Calculate the expected number of successful attempts
  const expectedSuccessfulAttempts = successProbabilityGivenEffort.reduce(
    (acc, point) => acc + point.successProbability,
    0
  ) / successProbabilityGivenEffort.length;

  // Calculate total expected fatalities
  return expectedSuccessfulAttempts * expectedAnnualAttempts * expectedFatalitiesPerSuccessfulAttempt;
};

export const getTimeToExecuteQueries = (points, startQueries, endQueries) => {
  const startTime = getTimeForQueries(startQueries, points);
  const endTime = getTimeForQueries(endQueries, points);
  return endTime - startTime;
};

export const getPostMitigationSuccessProbabilityGivenEffort = (queriesAttackerExecutesPerMonth, timeToExecuteQueries,preMitigationSuccessProbability) => {
  // console.log(timeToExecuteQueries);
  const result = structuredClone(preMitigationSuccessProbability);
  for (let i = 1; i < preMitigationSuccessProbability.length; i++) {
    let numQueriesExecuted = preMitigationSuccessProbability[i - 1].time / queriesAttackerExecutesPerMonth;
    let numQueriesThatWillBeExecuted = preMitigationSuccessProbability[i].time /  queriesAttackerExecutesPerMonth;
    let timeSpentJailbreaking = timeToExecuteQueries[numQueriesThatWillBeExecuted] - timeToExecuteQueries[numQueriesExecuted];

    result[i].time =
      result[i - 1].time +
      (preMitigationSuccessProbability[i].time - result[i - 1].time) +
      timeSpentJailbreaking;
  }
  return result;
};

export const runModel = (params) => {
  console.log("running model");
  // console.log("timeToExecuteQueries", params.timeToExecuteQueries);
  const postMitigationSuccessProbabilityGivenEffort = getPostMitigationSuccessProbabilityGivenEffort(
    params.queriesAttackerExecutesPerMonth,
    params.timeToExecuteQueries,
    params.preMitigationSuccessProbabilityGivenEffort
  );
  // console.log("queriesAttackerExecutesPerMonth", params.queriesAttackerExecutesPerMonth);
  // console.log("timeToExecuteQueries", params.timeToExecuteQueries);
  // console.log("preMitigationSuccessProbabilityGivenEffort", params.preMitigationSuccessProbabilityGivenEffort);
  // console.log("postMitigationSuccessProbabilityGivenEffort", postMitigationSuccessProbabilityGivenEffort);
  
  return {
    postMitigationSuccessProbabilityGivenEffort,
    baselineExpectedAnnualFatalities: calculateExpectedAnnualFatalities(
      params.baselineSuccessProbabilityGivenEffort,
      params.expectedAnnualAttempts,
      params.expectedFatalitiesPerSuccessfulAttempt
    ),
    preMitigationExpectedAnnualFatalities: calculateExpectedAnnualFatalities(
      params.preMitigationSuccessProbabilityGivenEffort,
      params.expectedAnnualAttempts,
      params.expectedFatalitiesPerSuccessfulAttempt
    ),
    postMitigationExpectedAnnualFatalities: calculateExpectedAnnualFatalities(
      postMitigationSuccessProbabilityGivenEffort,
      params.expectedAnnualAttempts,
      params.expectedFatalitiesPerSuccessfulAttempt
    )
  };
};
