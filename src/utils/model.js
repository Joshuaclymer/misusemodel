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

export const calculateTimeToExecuteQueriesGivenBans = ({
  bansGivenQueries,
  timeLostGivenBans,
  timeToExecuteQueries,
}) => {
  console.log("calculating time to execute queries given bans");
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
  
  // // Calculate tangent line from last two points
  // if (timeToExecuteQueriesGivenBans.length >= 2) {
  //   const lastPoint =
  //     timeToExecuteQueriesGivenBans[timeToExecuteQueriesGivenBans.length - 1];
  //   const prevPoint =
  //     timeToExecuteQueriesGivenBans[timeToExecuteQueriesGivenBans.length - 2];

  //   // Calculate slope using last two points
  //   const slope =
  //     (lastPoint.queries - prevPoint.queries) /
  //     (lastPoint.time - prevPoint.time);

  //   // Start from the last valid point and extrapolate until we hit bounds
  //   let currentTime = lastPoint.time;
  //   let currentQueries = lastPoint.queries;
  //   while currentQueries 
  //   const step = 0.1;

  //   while (currentTime < 45 && currentQueries < 45) {
  //     const nextTime = currentTime + step;
  //     const nextQueries =
  //       lastPoint.queries + slope * (nextTime - lastPoint.time);

  //     if (nextTime > 45 || nextQueries > 45) break;

  //     timeToExecuteQueriesGivenBans.push({
  //       time: nextTime,
  //       queries: nextQueries,
  //     });

  //     currentTime = nextTime;
  //     currentQueries = nextQueries;
  //   }
  // }

  console.log("returned");
  // for debugging
  // return Array.from({ length: 1000 }, (_, i) => i + 1)
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
  console.log("getting post mitigation success prob");
  // First calculate all points
  const timeToExecuteQueriesGivenBans =
    calculateTimeToExecuteQueriesGivenBans({
      bansGivenQueries: bansVsQueries,
      timeLostGivenBans,
      timeToExecuteQueries,
    }); // Convert days to months

  const points = [];
  for (let queries = 0; queries < timeToExecuteQueriesGivenBans.length; queries++) {
    const timeBetweenQueries = 1 / queriesAttackerExecutesPerMonth;
    const timeIfUnmitigated = queries * timeBetweenQueries;

    // console.log("bansVsQueries", bansVsQueries);
    // console.log("timeLostGivenBans", timeLostGivenBans);
    // console.log("timeToExecuteQueries", timeToExecuteQueries);
    // console.log("timeToExecuteQueriesGivenBans", timeToExecuteQueriesGivenBans);
    // Find the matching query point
    const queryPoint = timeToExecuteQueriesGivenBans.find(
      (point) => point.queries === queries
    );
    if (!queryPoint) {
      console.error("Error in getPostMitigationSuccessProbabilityGivenEffort:");
      console.error("Could not find time for queries:", queries);
      console.error("Available data points:", timeToExecuteQueriesGivenBans);
      continue;
    }
    const timeSpentJailbreaking = queryPoint.time / 30;
    // console.log("timeSpentJailbreaking", timeSpentJailbreaking);
    // console.log("timeIfUnmitigated", timeIfUnmitigated);
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
      params.bansVsQueries,
      params.timeLostToBans
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
