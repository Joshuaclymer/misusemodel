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
  tooltipDescription = "This plot synthesizes the other three plots. It shows the number of bio misuse queries members of the red team obtain responses to over time, factoring in the additional time that a real misuse actor would lose due to being repeatedly banned."
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

  const [plotWidth, setPlotWidth] = React.useState(Math.min(300, window.innerWidth - 40));
  const plotHeight = 260;
  const plotMargin = { top: 10, right: 40, left: 0, bottom: 30 };

  React.useEffect(() => {
    const handleResize = () => {
      setPlotWidth(Math.min(300, window.innerWidth - 40));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div>
      <h4 style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
        <span>Queries executed vs effort (w/ bans)</span>
        <div className="info-icon-tooltip" style={{ flexShrink: 0 }}>
          i
          <span className="tooltip">
            {tooltipDescription}
          </span>
        </div>
      </h4>
      <LineChart
        className="query-queries-chart"
        data={smoothedTimeToExecuteQueriesDisplayed}
        margin={plotMargin}
        width={plotWidth}
        height={plotHeight}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="time"
          type="number"
          domain={[0, 45]}
          ticks={[0, 15, 30, 45]}
          label={{ value: "Time spent jailbreaking (days)", position: "bottom", style: { fontSize: 12 } }}
          style={{ fontSize: 12 }}
        />
        <YAxis
          type="number"
          domain={[0, 45]}
          ticks={[0, 15, 30, 45]}
          label={{ value: "Queries executed", angle: -90, position: "center", dx: -10, style: { fontSize: 12 } }}
          style={{ fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
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
