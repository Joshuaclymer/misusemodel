import { fitQueriesCurve } from "../components/QueriesVsTime.jsx";
import { maxTimeMonths } from "../App.js";
import { generateCDFData } from "../components/EffortCDF.jsx";

// Calculate expected annual fatalities based on success probability and other factors
export const calculateExpectedAnnualFatalities = (
  successProbabilityGivenEffort,
  expectedAnnualAttempts,
  expectedFatalitiesPerSuccessfulAttempt,
  effortCDF
) => {

  console.log("successProbabilityGivenEffort", successProbabilityGivenEffort)

  // Calculate the expected number of successful attempts
  var sumOfSuccessProbabilities = 0;
  var sumOfTimeProbabilities = 0;
  for (let i = 1; i < effortCDF.length; i++) {
    const timeThisStep = effortCDF[i].months
    const nearestSuccessProbabilityPoint = successProbabilityGivenEffort.find(p => p.time >= timeThisStep) || successProbabilityGivenEffort[successProbabilityGivenEffort.length - 1];
    if (!nearestSuccessProbabilityPoint) {
      continue;
    }
    const probabilityOfTime = (effortCDF[i].cumulativeProbability - effortCDF[i - 1].cumulativeProbability);
    sumOfSuccessProbabilities += nearestSuccessProbabilityPoint.successProbability * probabilityOfTime;
    sumOfTimeProbabilities += probabilityOfTime;
  }
  // console.log("sumOfSuccess", sumOfSuccessProbabilities)
  // console.log("sumOfTime", sumOfTimeProbabilities);
  const expectedSuccess = sumOfSuccessProbabilities;
  const expectedAnnualFatalities = expectedSuccess * expectedAnnualAttempts * expectedFatalitiesPerSuccessfulAttempt;

  // Calculate total expected fatalities
  return expectedAnnualFatalities;
};

export const calculateTimeToExecuteQueriesGivenBans = ({
  bansGivenQueries,
  timeLostGivenBans,
  timeToExecuteQueries,
}) => {
  let timeToExecuteQueriesGivenBans = [];

  // Collect points with adaptive sampling
  let lastValidIndex = 0;
  let lastAddedTime = -1;
  const minTimeGap = 5; // Minimum gap between points to reduce density

  for (let i = 0; i <= 1000; i++) {
    const numBans = Math.floor(bansGivenQueries[i]);
    const totalTimeLostDueToBans = timeLostGivenBans[numBans];
    const execTime = timeToExecuteQueries[i] || 0;
    const time = execTime + totalTimeLostDueToBans;
    timeToExecuteQueriesGivenBans.push({
      time: time,
      queries: i,
    });
  }

  return timeToExecuteQueriesGivenBans;
};

// Helper function to interpolate values from an array of objects
const arrayToFunction = (array, inputKey, outputKey, inputValue) => {
  // Find the index of the first point that is greater than our input value
  const index = array.findIndex((point) => point[inputKey] > inputValue);

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
  timeLostGivenBans
) => {
  // First calculate all points
  const timeToExecuteQueriesGivenBans = calculateTimeToExecuteQueriesGivenBans({
    bansGivenQueries: bansVsQueries,
    timeLostGivenBans,
    timeToExecuteQueries,
  }); // Convert days to months

  const points = [];
  for (
    let queries = 0;
    queries < timeToExecuteQueriesGivenBans.length;
    queries++
  ) {
    const timeBetweenQueries = 1 / queriesAttackerExecutesPerMonth;
    const timeIfUnmitigated = queries * timeBetweenQueries;

    // Find the matching query point
    const queryPoint = timeToExecuteQueriesGivenBans.find(
      (point) => point.queries === queries
    );
    if (!queryPoint) {
      continue;
    }
    const timeSpentJailbreaking = queryPoint.time / 30;
    const totalTime = timeIfUnmitigated + timeSpentJailbreaking;

    const successProbability = arrayToFunction(
      preMitigationSuccessProbability,
      "time",
      "successProbability",
      timeIfUnmitigated
    );


    if (totalTime < 0.1) continue;
    else
      points.push({
        time: totalTime,
        successProbability: successProbability,
      });
  }

  // Filter out points with zero time, truncate at maxTimeMonths, and sort by time
  const validPoints = points
    .filter((p) => p.time >= 0.1 && p.time <= maxTimeMonths)
    .sort((a, b) => a.time - b.time)
    // Convert to expected format
    .map((p) => ({
      time: p.time,
      successProbability: p.successProbability,
    }));

  return validPoints;
};

export const runModel = (params) => {
  const postMitigationSuccessProbabilityGivenEffort =
    getPostMitigationSuccessProbabilityGivenEffort(
      params.queriesAttackerExecutesPerMonth,
      params.timeToExecuteQueries,
      params.preMitigationSuccessProbabilityGivenEffort,
      params.bansVsQueries,
      params.timeLostToBans
    );
  const baselineExpectedAnnualFatalities = calculateExpectedAnnualFatalities(
    params.baselineSuccessProbabilityGivenEffort,
    params.expectedAnnualAttempts,
    params.expectedFatalitiesPerSuccessfulAttempt,
    params.effortCDF
  );

  const preMitigationExpectedAnnualFatalities =
    calculateExpectedAnnualFatalities(
      params.preMitigationSuccessProbabilityGivenEffort,
      params.expectedAnnualAttempts,
      params.expectedFatalitiesPerSuccessfulAttempt,
      params.effortCDF
    );
  

  const postMitigationExpectedAnnualFatalities =
    calculateExpectedAnnualFatalities(
      postMitigationSuccessProbabilityGivenEffort,
      params.expectedAnnualAttempts,
      params.expectedFatalitiesPerSuccessfulAttempt,
      params.effortCDF
    );

  return {
    postMitigationSuccessProbabilityGivenEffort,
    baselineExpectedAnnualFatalities,
    preMitigationExpectedAnnualFatalities,
    postMitigationExpectedAnnualFatalities,
  };
};
