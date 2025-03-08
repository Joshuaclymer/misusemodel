import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getBansForQueries } from "./TimeLostToBans.jsx";
import { calculateTimeToExecuteQueriesGivenBans } from "../utils/model.js";

const QueriesVsTimeWithBans = ({
  timeToExecuteQueries, // timeToExecuteQueries
  bansGivenQueries, // from BansVsQueries
  timeLostGivenBans = [], // from TimeLostToBans
}) => {
  let timeToExecuteQueriesDisplayed = calculateTimeToExecuteQueriesGivenBans({
    bansGivenQueries,
    timeLostGivenBans,
    timeToExecuteQueries,
  });
  let smoothedTimeToExecuteQueriesDisplayed = [];
  let lastAddedTime = -1;
  let lastValidIndex = -1;
  const minTimeGap = 5; // Minimum gap between points to reduce density
  for (let i = 0; i < timeToExecuteQueriesDisplayed.length; i++) {
    const { time, queries } = timeToExecuteQueriesDisplayed[i];
    if (i === 0 || time - lastAddedTime >= minTimeGap || i === 45) {
      lastAddedTime = time;
      lastValidIndex = i;
      smoothedTimeToExecuteQueriesDisplayed.push({
        time: time,
        queries: queries,
      });
    }
    // Add point if it's the first point, last point, or if enough time has passed
    if (time > 45 || queries > 45) {
      lastAddedTime = time;
      lastValidIndex = i;
      let lastPointQueriesBeforeAdjustment = queries;
      let lastPointTimeBeforeAdjustment = time;
      // Adjust the last point time so that it is within the plot's bounds (45 by 45). Adjust via linear interpolation
      if (lastPointTimeBeforeAdjustment > 45) {
        let lastPointTimeAfterAdjustment = 45;
        const prevPoint =
          smoothedTimeToExecuteQueriesDisplayed[
            smoothedTimeToExecuteQueriesDisplayed.length - 1
          ];
        const t =
          (45 - prevPoint.time) /
          (lastPointTimeBeforeAdjustment - prevPoint.time);
        let lastPointQueriesAfterAdjustment =
          prevPoint.queries +
          t * (lastPointQueriesBeforeAdjustment - prevPoint.queries);
        lastPointQueriesAfterAdjustment = Math.min(
          45,
          lastPointQueriesAfterAdjustment
        );
        smoothedTimeToExecuteQueriesDisplayed.push({
          time: lastPointTimeAfterAdjustment,
          queries: lastPointQueriesAfterAdjustment,
        });
      } else if (lastPointQueriesBeforeAdjustment > 45) {
        let lastPointQueriesAfterAdjustment = 45;
        const prevPoint =
          smoothedTimeToExecuteQueriesDisplayed[
            smoothedTimeToExecuteQueriesDisplayed.length - 1
          ];
        const t =
          (45 - prevPoint.queries) /
          (lastPointQueriesBeforeAdjustment - prevPoint.queries);
        let lastPointTimeAfterAdjustment =
          prevPoint.time + t * (lastPointTimeBeforeAdjustment - prevPoint.time);
        lastPointTimeAfterAdjustment = Math.min(
          45,
          lastPointTimeAfterAdjustment
        );
        smoothedTimeToExecuteQueriesDisplayed.push({
          time: lastPointTimeAfterAdjustment,
          queries: lastPointQueriesAfterAdjustment,
        });
      }
      break;
    }
  }

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
        Queries vs Time with Bans
      </h3>
      <LineChart
        data={smoothedTimeToExecuteQueriesDisplayed}
        margin={{ top: 5, right: 30, left: 40, bottom: 20 }}
        width={300}
        height={250}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          domain={[0, 45]}
          ticks={[0, 15, 30, 45]}
          label={{ value: "Time (days)", position: "bottom" }}
        />
        <YAxis
          type="number"
          domain={[0, 45]}
          ticks={[0, 15, 30, 45]}
          label={{ value: "Queries", angle: -90, position: "left" }}
        />
        <Tooltip
          formatter={(value, name) => [
            value.toFixed(2),
            name === "queries" ? "Queries" : "Time (days)",
          ]}
        />
        <Line
          type="monotone"
          dataKey="queries"
          stroke="#3498DB"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </div>
  );
};

export default QueriesVsTimeWithBans;
