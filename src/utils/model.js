import { fitQueriesCurve } from "../components/QueriesVsTime.jsx";
import { maxTimeMonths } from "../App.js";

// Calculate expected annual fatalities based on success probability and other factors
export const calculateExpectedAnnualFatalities = (
  successProbabilityGivenEffort,
  expectedAnnualAttempts,
  expectedFatalitiesPerSuccessfulAttempt
) => {
  // Calculate the expected number of successful attempts
  const expectedSuccessfulAttempts =
    successProbabilityGivenEffort.reduce(
      (acc, point) => acc + point.successProbability,
      0
    ) / successProbabilityGivenEffort.length;

  // Calculate total expected fatalities
  return (
    expectedSuccessfulAttempts *
    expectedAnnualAttempts *
    expectedFatalitiesPerSuccessfulAttempt
  );
};

// Helper function to interpolate values from an array of objects
const arrayToFunction = (array, inputKey, outputKey, inputValue) => {
  // Find the index of the first point that is greater than our input value
  const index = array.findIndex(point => point[inputKey] > inputValue);

  if (index === -1) return array[array.length - 1][outputKey]; // Value is after last point
  if (index === 0) return array[0][outputKey]; // Value is before first point

  // Interpolate between the two points
  const point1 = array[index - 1];
  const point2 = array[index];
  const ratio =
    (inputValue - point1[inputKey]) / (point2[inputKey] - point1[inputKey]);
  return point1[outputKey] + ratio * (point2[outputKey] - point1[outputKey]);
};

export const getTimeToExecuteQueries = (points, startQueries, endQueries) => {
  const startTime = fitQueriesCurve(startQueries, points);
  const endTime = fitQueriesCurve(endQueries, points);
  return endTime - startTime;
};

export const getPostMitigationSuccessProbabilityGivenEffort = (
  queriesAttackerExecutesPerMonth,
  timeToExecuteQueries,
  preMitigationSuccessProbability,
  bansVsQueries,
) => {
  console.log("0", bansVsQueries);
  console.log("A,", timeToExecuteQueries);
  console.log("B,", queriesAttackerExecutesPerMonth);
  console.log("C,", preMitigationSuccessProbability);
  // First calculate all points
  const points = [];
  for (let queries = 0; queries < timeToExecuteQueries.length; queries++) {
    const timeBetweenQueries = 1 / queriesAttackerExecutesPerMonth;
    const timeIfUnmitigated = queries * timeBetweenQueries; 
    const timeSpentJailbreaking = timeToExecuteQueries[queries] / 30; // Convert days to months
    const totalTime = timeIfUnmitigated + timeSpentJailbreaking;
    
    const successProbability = arrayToFunction(
      preMitigationSuccessProbability,
      "time",
      "successProbability",
      timeIfUnmitigated
    );

    // if (totalTime < 60) {
    //   console.log(`Debug early point:\n  queries=${queries}\n  timeBetweenQueries=${timeBetweenQueries}\n  timeIfUnmitigated=${timeIfUnmitigated}\n  timeSpentJailbreaking=${timeSpentJailbreaking}\n  totalTime=${totalTime}\n  successProbability=${successProbability}`);
    // }

    if (totalTime < 0.1) continue;
    else points.push({
      time: totalTime,
      successProbability: successProbability,
    });
  }

  // Filter out points with zero time, truncate at maxTimeMonths, and sort by time
  const validPoints = points
    .filter((p) => p.time >= 0.1 && p.time <= maxTimeMonths)
    .sort((a, b) => a.time - b.time)
    // Convert to expected format
    .map(p => ({
      time: p.time,
      successProbability: p.successProbability
    }));

  console.log("Valid points:", validPoints);
  return validPoints;
};

export const runModel = (params) => {
  console.log("running model");
  // console.log("timeToExecuteQueries", params.timeToExecuteQueries);
  const postMitigationSuccessProbabilityGivenEffort =
    getPostMitigationSuccessProbabilityGivenEffort(
      params.queriesAttackerExecutesPerMonth,
      params.timeToExecuteQueries,
      params.preMitigationSuccessProbabilityGivenEffort,
      params.bansVsQueries
    );
  console.log(
    "RESULT: postMitigationSuccessProbabilityGivenEffort",
    postMitigationSuccessProbabilityGivenEffort
  );

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
    ),
  };
};
