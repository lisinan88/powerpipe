import get from "lodash/get";
import sortBy from "lodash/sortBy";
import CallToActions from "../CallToActions";
import LoadingIndicator from "../dashboards/LoadingIndicator";
import {
  AvailableDashboard,
  AvailableDashboardsDictionary,
  DashboardAction,
  DashboardActions,
  ModServerMetadata,
} from "@powerpipe/types";
import { classNames } from "@powerpipe/utils/styles";
import { default as lodashGroupBy } from "lodash/groupBy";
import { Fragment, useEffect, useState } from "react";
import { getComponent } from "../dashboards";
import { stringToColor } from "@powerpipe/utils/color";
import { useDashboard } from "@powerpipe/hooks/useDashboard";
import { useParams } from "react-router-dom";

type DashboardListSection = {
  title: string;
  dashboards: AvailableDashboardWithMod[];
};

type AvailableDashboardWithMod = AvailableDashboard & {
  mod?: ModServerMetadata;
};

type DashboardTagProps = {
  tagKey: string;
  tagValue: string;
  dispatch?: (action: DashboardAction) => void;
  searchValue?: string;
};

type SectionProps = {
  title: string;
  dashboards: AvailableDashboardWithMod[];
  dispatch: (action: DashboardAction) => void;
  searchValue: string;
  searchPathPrefix: string[];
};

const DashboardTag = ({
  tagKey,
  tagValue,
  dispatch,
  searchValue,
}: DashboardTagProps) => (
  <span
    className={classNames(
      "rounded-md text-xs",
      dispatch ? "cursor-pointer" : null,
    )}
    onClick={
      dispatch
        ? () => {
            const existingSearch = searchValue ? searchValue.trim() : "";
            const searchWithTag = existingSearch
              ? existingSearch.indexOf(tagValue) < 0
                ? `${existingSearch} ${tagValue}`
                : existingSearch
              : tagValue;
            dispatch({
              type: DashboardActions.SET_DASHBOARD_SEARCH_VALUE,
              value: searchWithTag,
            });
          }
        : undefined
    }
    style={{ color: stringToColor(tagValue) }}
    title={`${tagKey} = ${tagValue}`}
  >
    {tagValue}
  </span>
);

const TitlePart = ({ part, searchPathPrefix }) => {
  const ExternalLink = getComponent("external_link");

  return (
    <ExternalLink
      className="link-highlight hover:underline"
      ignoreDataMode
      to={`/${part.full_name}${!!searchPathPrefix.length ? `?search_path_prefix=${searchPathPrefix}` : ""}`}
    >
      {part.title || part.short_name}
    </ExternalLink>
  );
};

const BenchmarkTitle = ({ benchmark, searchValue, searchPathPrefix }) => {
  const { dashboardsMap } = useDashboard();
  const ExternalLink = getComponent("external_link");

  if (!searchValue) {
    return (
      <ExternalLink
        className="link-highlight hover:underline"
        ignoreDataMode
        to={`/${benchmark.full_name}${!!searchPathPrefix.length ? `?search_path_prefix=${searchPathPrefix}` : ""}`}
      >
        {benchmark.title || benchmark.short_name}
      </ExternalLink>
    );
  }

  const parts: AvailableDashboard[] = [];

  for (const trunk of benchmark.trunks[0]) {
    const part = dashboardsMap[trunk];
    if (part) {
      parts.push(part);
    }
  }

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={part.full_name}>
          {!!index && (
            <span className="px-1 text-sm text-foreground-lighter">{">"}</span>
          )}
          <TitlePart part={part} searchPathPrefix={searchPathPrefix} />
        </Fragment>
      ))}
    </>
  );
};

const Section = ({
  title,
  dashboards,
  dispatch,
  searchValue,
  searchPathPrefix,
}: SectionProps) => {
  return (
    <div className="space-y-2">
      <h3 className="truncate">{title}</h3>
      {dashboards.map((dashboard) => (
        <div key={dashboard.full_name} className="flex space-x-2 items-center">
          <div className="md:col-span-6 truncate">
            {(dashboard.type === "dashboard" ||
              dashboard.type === "snapshot") && (
              <TitlePart part={dashboard} searchPathPrefix={searchPathPrefix} />
            )}
            {dashboard.type === "benchmark" && (
              <BenchmarkTitle
                benchmark={dashboard}
                searchValue={searchValue}
                searchPathPrefix={searchPathPrefix}
              />
            )}
          </div>
          <div className="hidden md:block col-span-6 space-x-2">
            {Object.entries(dashboard.tags || {}).map(([key, value]) => {
              if (key !== "category" && key !== "service" && key !== "type") {
                return null;
              }
              return (
                <DashboardTag
                  key={key}
                  tagKey={key}
                  tagValue={value}
                  dispatch={dispatch}
                  searchValue={searchValue}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

type GroupedDashboards = {
  [key: string]: AvailableDashboardWithMod[];
};

const useGroupedDashboards = (dashboards, group_by, metadata) => {
  const [sections, setSections] = useState<DashboardListSection[]>([]);

  useEffect(() => {
    let groupedDashboards: GroupedDashboards;
    if (group_by.value === "tag") {
      groupedDashboards = lodashGroupBy(dashboards, (dashboard) => {
        return get(dashboard, `tags["${group_by.tag}"]`, "Other");
      });
    } else {
      groupedDashboards = lodashGroupBy(dashboards, (dashboard) => {
        return get(
          dashboard,
          `mod.title`,
          get(dashboard, "mod.short_name", "Other"),
        );
      });
    }
    setSections(
      Object.entries(groupedDashboards)
        .map(([k, v]) => ({
          title: k,
          dashboards: v,
        }))
        .sort((x, y) => {
          if (y.title === "Other") {
            return -1;
          }
          if (x.title < y.title) {
            return -1;
          }
          if (x.title > y.title) {
            return 1;
          }
          return 0;
        }),
    );
  }, [dashboards, group_by, metadata]);

  return sections;
};

const searchAgainstDashboard = (
  dashboard: AvailableDashboardWithMod,
  searchParts: string[],
): boolean => {
  const joined = `${dashboard.mod?.title || dashboard.mod?.short_name || ""} ${
    dashboard.title || dashboard.short_name || ""
  } ${Object.entries(dashboard.tags || {})
    .map(([tagKey, tagValue]) => `${tagKey}=${tagValue}`)
    .join(" ")}`.toLowerCase();
  return searchParts.every((searchPart) => joined.indexOf(searchPart) >= 0);
};

const sortDashboardSearchResults = (
  dashboards: AvailableDashboard[] = [],
  dashboardsMap: AvailableDashboardsDictionary,
) => {
  return sortBy(dashboards, [
    (d) => {
      if (
        d.type === "dashboard" ||
        !d.trunks ||
        d.trunks.length === 0 ||
        d.trunks[0].length === 0
      ) {
        return (d.title || d.short_name).toLowerCase();
      }
      return d.trunks[0]
        .map((t) => {
          const part = dashboardsMap[t];
          if (!part) {
            return null;
          }
          return part.title || part.short_name;
        })
        .filter((t) => !!t)
        .join(" > ")
        .toLowerCase();
    },
  ]);
};

const DashboardList = () => {
  const {
    availableDashboardsLoaded,
    cliMode,
    components: { DashboardListEmptyCallToAction },
    dashboards,
    dashboardsMap,
    dispatch,
    metadata,
    search: { value: searchValue, groupBy: searchGroupBy },
    searchPathPrefix,
  } = useDashboard();
  const [unfilteredDashboards, setUnfilteredDashboards] = useState<
    AvailableDashboardWithMod[]
  >([]);
  const [unfilteredTopLevelDashboards, setUnfilteredTopLevelDashboards] =
    useState<AvailableDashboardWithMod[]>([]);
  const [filteredDashboards, setFilteredDashboards] = useState<
    AvailableDashboardWithMod[]
  >([]);

  // Initialise dashboards with their mod + update when the list of dashboards is updated
  useEffect(() => {
    if (!metadata || !availableDashboardsLoaded || !dashboardsMap) {
      setUnfilteredDashboards([]);
      return;
    }

    const dashboardsWithMod: AvailableDashboardWithMod[] = [];
    const topLevelDashboardsWithMod: AvailableDashboardWithMod[] = [];
    const newDashboardTagKeys: string[] = [];
    for (const dashboard of dashboards) {
      const dashboardMod = dashboard.mod_full_name;
      let mod: ModServerMetadata;
      if (dashboardMod === metadata.mod.full_name) {
        mod = get(metadata, "mod", {}) as ModServerMetadata;
      } else {
        mod = get(
          metadata,
          `installed_mods["${dashboardMod}"]`,
          {},
        ) as ModServerMetadata;
      }
      let dashboardWithMod: AvailableDashboardWithMod;
      dashboardWithMod = { ...dashboard };
      dashboardWithMod.mod = mod;
      dashboardsWithMod.push(dashboardWithMod);

      if (dashboard.is_top_level) {
        topLevelDashboardsWithMod.push(dashboardWithMod);
      }

      Object.entries(dashboard.tags || {}).forEach(([tagKey]) => {
        if (!newDashboardTagKeys.includes(tagKey)) {
          newDashboardTagKeys.push(tagKey);
        }
      });
    }
    setUnfilteredDashboards(dashboardsWithMod);
    setUnfilteredTopLevelDashboards(topLevelDashboardsWithMod);
    dispatch({
      type: DashboardActions.SET_DASHBOARD_TAG_KEYS,
      keys: newDashboardTagKeys,
    });
  }, [
    availableDashboardsLoaded,
    dashboards,
    dispatch,
    dashboardsMap,
    metadata,
  ]);

  // Filter dashboards according to the search
  useEffect(() => {
    if (!availableDashboardsLoaded || !metadata) {
      return;
    }
    if (!searchValue) {
      setFilteredDashboards(unfilteredDashboards);
      return;
    }

    const searchParts = searchValue.trim().toLowerCase().split(" ");
    const filtered: AvailableDashboard[] = [];

    unfilteredDashboards.forEach((dashboard) => {
      const include = searchAgainstDashboard(dashboard, searchParts);
      if (include) {
        filtered.push(dashboard);
      }
    });

    setFilteredDashboards(sortDashboardSearchResults(filtered, dashboardsMap));
  }, [
    availableDashboardsLoaded,
    dashboardsMap,
    unfilteredDashboards,
    metadata,
    searchValue,
  ]);

  const sections = useGroupedDashboards(
    searchValue ? filteredDashboards : unfilteredTopLevelDashboards,
    searchGroupBy,
    metadata,
  );

  return (
    <div className="w-full grid grid-cols-12 gap-x-4">
      <div className="col-span-12 lg:col-span-9 space-y-4">
        <div className="grid grid-cols-6">
          {(!availableDashboardsLoaded || !metadata) && (
            <div className="col-span-6 mt-2 ml-1 text-black-scale-4 flex items-center">
              <LoadingIndicator className="mr-3 w-5 h-5" />{" "}
              <span className="italic -ml-1">Loading...</span>
            </div>
          )}
          <div className="col-span-6">
            {availableDashboardsLoaded &&
              metadata &&
              filteredDashboards.length === 0 && (
                <div className="col-span-6 mt-2">
                  {searchValue ? (
                    <>
                      <span>No search results.</span>{" "}
                      <span
                        className="link-highlight"
                        onClick={() =>
                          dispatch({
                            type: DashboardActions.SET_DASHBOARD_SEARCH_VALUE,
                            value: "",
                          })
                        }
                      >
                        Clear
                      </span>
                      .
                    </>
                  ) : (
                    <DashboardListEmptyCallToAction />
                  )}
                </div>
              )}
            <div className="space-y-4">
              {sections.map((section) => (
                <Section
                  key={section.title}
                  title={section.title}
                  dashboards={section.dashboards}
                  dispatch={dispatch}
                  searchValue={searchValue}
                  searchPathPrefix={searchPathPrefix}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-3 mt-4 lg:mt-2">
        <CallToActions cliMode={cliMode} />
      </div>
    </div>
  );
};

const DashboardListWrapper = ({ wrapperClassName = "" }) => {
  const { dashboard_name } = useParams();
  const { search } = useDashboard();

  // If we have a dashboard selected and no search, we don't want to show the list
  if (dashboard_name && !search.value) {
    return null;
  }

  return (
    <div className={wrapperClassName}>
      <DashboardList />
    </div>
  );
};

export default DashboardListWrapper;

export { DashboardTag };
