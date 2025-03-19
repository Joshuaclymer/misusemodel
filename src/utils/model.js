import { fitQueriesCurve } from "../components/QueriesVsTime.jsx";
import { maxTimeMonths } from "../App.js";
import { generateCDFData } from "../components/EffortCDF.jsx";

// Calculate expected annual fatalities based on success probability and other factors

const findNearestPointBinarySearch = (arr, targetTime) => {
  // Edge cases
  if (arr.length === 0) return null;
  if (arr[arr.length - 1].time < targetTime) return arr[arr.length - 1]; // Return last point if target is beyond all points
  if (arr[0].time >= targetTime) return arr[0]; // Return first point if target is before all points
  
  let left = 0;
  let right = arr.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    // Found exact match
    if (arr[mid].time === targetTime) {
      return arr[mid];
    }
    
    // Target is in right half
    if (arr[mid].time < targetTime) {
      left = mid + 1;
    } 
    // Target is in left half
    else {
      right = mid - 1;
    }
  }
  
  // At this point, left > right
  // left is the index of the first element >= target
  return arr[left];
};

export const calculateSuccessDistribution = (successProbabilityGivenEffort, effortCDF, timePoints) => {
  // First normalize successProbabilityGivenEffort to bins

  const successDistribution = [];
  for (let i = 1; i < effortCDF.length; i++) {
    const timeThisStep = effortCDF[i].months;
    const probabilityOfTime = (effortCDF[i].cumulativeProbability - effortCDF[i - 1].cumulativeProbability);
    const successProbabilityDuringTime = findNearestPointBinarySearch(successProbabilityGivenEffort, timeThisStep).successProbability * probabilityOfTime;
    successDistribution.push({
      time: timeThisStep,
      successProbability: successProbabilityDuringTime
    });
  }

  return successDistribution;
};

export const calculateExpectedAnnualFatalities = (
  successProbabilityGivenEffort,
  expectedAnnualAttempts,
  expectedFatalitiesPerSuccessfulAttempt,
  effortCDF
) => {


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
  
  const simulationResults = simulateDeployment(params);
  const mainlineRiskProjection = simulationResults.mainlineRiskProjection;
  const riskProjectionWithJailbreak = simulationResults.riskProjectionWithJailbreak;

  return {
    postMitigationSuccessProbabilityGivenEffort,
    baselineExpectedAnnualFatalities,
    preMitigationExpectedAnnualFatalities,
    postMitigationExpectedAnnualFatalities,
    mainlineRiskProjection,
    riskProjectionWithJailbreak
  };
};

const simulateDeployment = (params) => {
  const postMitigationSuccessProbability = getPostMitigationSuccessProbabilityGivenEffort(
    params.queriesAttackerExecutesPerMonth,
    params.timeToExecuteQueries,
    params.preMitigationSuccessProbabilityGivenEffort,
    params.bansVsQueries,
    params.timeLostToBans
  );

  // Simulate normal deployment
  const lengthOfDeployment = 480;
  const numberOfSimulations = 1000;

  const simulationResults = {
    mainlineRiskProjection: [],
    riskProjectionWithJailbreak: []
  };
  // console.log("successDistributions", successDistributions)
  // calculate annualized risk for each period of time
  const numTimePoints = 100;
  const timePoints = Array.from({ length: numTimePoints }, (_, i) => (i + 1) * (lengthOfDeployment / numTimePoints));

  // -----------get post mitigation success distribution ---------------
  const successDistribution  = calculateSuccessDistribution(postMitigationSuccessProbability, params.effortCDF, timePoints);

  // now map the success distribution to time points
  const timePointsObjects = timePoints.map(p => ({time: p}));
  var successDistributionAlignedToTimePoints = timePointsObjects.map(p => ({
    time: p.time,
    successProbability: p.time > successDistribution[successDistribution.length - 1].time ? 0 : findNearestPointBinarySearch(successDistribution, p.time).successProbability
  }));
  // console.log("sum of success probabilities", successDistributionAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0));

  // Now renormalize so that the sum under the distribution is the same as before
  const renormalizationFactor = successDistribution.reduce((acc, p) => acc + p.successProbability, 0) / successDistributionAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0);
  successDistributionAlignedToTimePoints = successDistributionAlignedToTimePoints.map(p => ({
    time: p.time,
    successProbability: p.successProbability * renormalizationFactor
  }));
  // console.log("sum of success probabilities after renormalization", successDistributionAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0));

  // -----------get pre mitigation success distribution ---------------
  const jailbreakTime = params.jailbreakTime;

  const successDistributionPreMitigation  = calculateSuccessDistribution(params.preMitigationSuccessProbabilityGivenEffort, params.effortCDF, timePoints);

  // now map the success distribution to time points
  var successDistributionPreMitigationAlignedToTimePoints = timePointsObjects.map(p => ({
    time: p.time,
    successProbability: p.time > successDistributionPreMitigation[successDistributionPreMitigation.length - 1].time ? 0 : findNearestPointBinarySearch(successDistributionPreMitigation, p.time).successProbability
  }));
  // console.log("sum of success probabilities", successDistributionPreMitigation.reduce((acc, p) => acc + p.successProbability, 0));

  // Now renormalize so that the sum under the distribution is the same as before
  const renormalizationFactorPreMitigation = successDistributionPreMitigation.reduce((acc, p) => acc + p.successProbability, 0) / successDistributionPreMitigationAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0);
  successDistributionPreMitigationAlignedToTimePoints = successDistributionPreMitigationAlignedToTimePoints.map(p => ({
    time: p.time,
    successProbability: p.successProbability * renormalizationFactorPreMitigation
  }));
  // console.log("sum of success probabilities after renormalization", successDistributionPreMitigationAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0));

  const mainlineRiskProjections = [];
  const jailbreakRiskProjections = [];
  for (let sim = 0; sim < numberOfSimulations; sim++) {

    const numAttemptsInPeriod = Math.floor(lengthOfDeployment / 12 * params.expectedAnnualAttempts); // This was changed
    // const numAttemptsInPeriod = 2
    // console.log("numAttemptsInPeriod", numAttemptsInPeriod)
    const timesAttemptsStart = Array.from({ length: numAttemptsInPeriod }, () => Math.floor(Math.random() * timePoints.length));
    // const timesAttemptsStart = [0]


    /// -----------get mainline risk projection ---------------
    const riskProjection = [] 
    for (let i = 0; i < timePoints.length; i++) {
      let sum = 0
      for (let attempt = 0; attempt < numAttemptsInPeriod; attempt++) {
        const attemptStart = timesAttemptsStart[attempt];
        if (attemptStart <= i){
          sum += successDistributionAlignedToTimePoints[i - attemptStart].successProbability;
        }
      }
      riskProjection.push({
        time: timePoints[i],
        risk: sum * params.expectedFatalitiesPerSuccessfulAttempt * (12 / (lengthOfDeployment / numTimePoints))
      });
    }
    mainlineRiskProjections.push(riskProjection);

    /// -----------get jailbreak risk projection ---------------
    const jailbreakRiskProjection = []
    for (let i = 0; i < timePoints.length; i++) {
      let sum = 0
      for (let attempt = 0; attempt < numAttemptsInPeriod; attempt++) {
        const attemptStart = timesAttemptsStart[attempt];
        if (attemptStart <= i){
          if (timePoints[i] <= jailbreakTime) {
            sum += successDistributionAlignedToTimePoints[i - attemptStart].successProbability;
          } else if (timePoints[i] > jailbreakTime) {
            sum += successDistributionPreMitigationAlignedToTimePoints[i - attemptStart].successProbability;
          }
        }
      }
      jailbreakRiskProjection.push({
        time: timePoints[i],
        risk: sum * params.expectedFatalitiesPerSuccessfulAttempt * (12 / (lengthOfDeployment / numTimePoints))
      });
    }
    jailbreakRiskProjections.push(jailbreakRiskProjection);
  }
  // console.log("mainlineRiskProjections", mainlineRiskProjections)

  // accumulate simulation results by averaging risk projections
  let mainlineRiskProjectionAggregated = []
  for (let i = 0; i < timePoints.length; i++) {
    let sumValuesAtTime = 0
    for (let j = 0; j < mainlineRiskProjections.length; j++) {
      sumValuesAtTime += mainlineRiskProjections[j][i] .risk;
    }
    const average = sumValuesAtTime / mainlineRiskProjections.length;

    mainlineRiskProjectionAggregated.push({
      time: timePoints[i],
      risk: average
    });
  }

  // aggregate jailbreak risk projection
  let jailbreakRiskProjectionAggregated = []
  for (let i = 0; i < timePoints.length; i++) {
    let sumValuesAtTime = 0
    for (let j = 0; j < jailbreakRiskProjections.length; j++) {
      sumValuesAtTime += jailbreakRiskProjections[j][i] .risk;
    }
    const average = sumValuesAtTime / jailbreakRiskProjections.length;

    jailbreakRiskProjectionAggregated.push({
      time: timePoints[i],
      risk: average
    });
  }

  simulationResults.mainlineRiskProjection = mainlineRiskProjectionAggregated;
  simulationResults.riskProjectionWithJailbreak = jailbreakRiskProjectionAggregated;

  return simulationResults;
}

