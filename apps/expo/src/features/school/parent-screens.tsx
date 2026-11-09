import { NotificationPanel } from "./notification-panel";
import { WorkflowPanel } from "./workflow-panel";
import { AdCarousel, AdPopup, AdPreview } from "./ads";
import { AdComposer, AdComposerLauncher } from "./ad-composer";
import { SchoolDataBoundary } from "@school-connect/backend/react";
import { NOTICE_CATEGORIES, RESOURCE_CATEGORIES } from "@school-connect/core/domain";
import {
  monthCells,
  schoolDate,
  monthRange,
  moveMonth,
  eventDays,
} from "@school-connect/core/calendar";
import { shareEvent } from "./calendar-export";
import { schoolConfig } from "@school-connect/core";
import { useState } from "react";
import { ActivityIndicator, Pressable, View, Linking } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import type { ReadModule, ReadOptions, ModuleRecord } from "@school-connect/core/live";
import {
  canAccessModule,
  accessRolesFor,
  type SchoolModule,
} from "@school-connect/core/permissions";
import type { Id } from "@school-connect/backend/dataModel";
import { colors } from "@/theme/school";
import { useModule, useRecords, useDetail, useDashboard, useReceipt, useSchool } from "./store";
import {
  Chips,
  Badge,
  Button,
  Card,
  ChildPicker,
  Empty,
  Feedback,
  Field,
  Heading,
  LinkRow,
  Screen,
  Text,
  s,
} from "./ui";
function open(path: string) {
  router.push(path as Href);
}
function Row({
  record,
  path,
  onOpen,
}: {
  record: ModuleRecord;
  path?: string;
  onOpen?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={path || onOpen ? "button" : undefined}
      disabled={!path && !onOpen}
      onPress={() => (onOpen ? onOpen() : path && open(path))}
    >
      <Card>
        {record.media?.kind === "image" && (
          <Image
            source={{ uri: record.media.url }}
            style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 16 }}
            contentFit="cover"
            accessibilityLabel={record.title}
          />
        )}
        {record.media?.kind === "video" && <Badge label="Video ad" />}
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text weight="bold">{record.title}</Text>
            <Text style={s.small}>{record.subtitle}</Text>
          </View>
          {record.status ? <Badge label={record.status} /> : null}
        </View>
        {record.at !== null && (
          <Text style={s.small}>
            {new Date(record.at).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}
          </Text>
        )}
        {record.body ? (
          <Text numberOfLines={3} style={s.muted}>
            {record.body}
          </Text>
        ) : null}
        {record.amountCents !== null && (
          <Text weight="bold">
            {new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
              record.amountCents / 100,
            )}
          </Text>
        )}
        {(record.canAcknowledge || record.canMarkRead) && (
          <Text style={s.small}>
            {record.acknowledged ? "Acknowledged" : record.read ? "Read" : "Unread"}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}
function QueryState({ result }: { result: ReturnType<typeof useModule> }) {
  if (result.status === "loading")
    return (
      <View accessibilityRole="progressbar" style={{ padding: 20 }}>
        <ActivityIndicator color={colors.primary} />
        <Text>Loading your school information...</Text>
      </View>
    );
  if (result.status === "error")
    return (
      <Card>
        <Feedback error message="This information could not be loaded." />
        <Button title="Try again" onPress={result.retry} />
      </Card>
    );
  if (result.status === "ready" && !result.data?.records.length)
    return (
      <Empty
        title="Nothing here just yet"
        body="No records are available for your account and selection."
      />
    );
  return null;
}
function DataFailure({ retry }: { retry: () => void }) {
  return (
    <Card>
      <Feedback error message="This information could not be loaded." />
      <Button title="Try again" onPress={retry} />
    </Card>
  );
}
function Boundary({ children }: { children: React.ReactNode }) {
  return (
    <SchoolDataBoundary fallback={(retry) => <DataFailure retry={retry} />}>
      {children}
    </SchoolDataBoundary>
  );
}
export function ModuleList({
  module,
  title,
  detail,
}: {
  module: SchoolModule;
  title: string;
  detail?: string;
}) {
  const { account } = useSchool();
  const allowed = canAccessModule(
    accessRolesFor(account?.roles ?? [], !!account?.learners.length),
    module,
    account?.disabledModules,
  );
  return (
    <Screen title={title} subtitle="Shared securely with your school account.">
      <ChildPicker />
      {allowed ? (
        <Boundary>
          <ModuleContent module={module} detail={detail} />
        </Boundary>
      ) : (
        <Empty
          title="Access unavailable"
          body="This module is not available to your school account."
        />
      )}
    </Screen>
  );
}
function ModuleContent({ module, detail }: { module: SchoolModule; detail?: string }) {
  const [source, setSource] = useState<ReadModule>(module);
  return (
    <>
      {(module === "groups" || module === "payments" || module === "people") && (
        <Chips
          items={
            module === "groups"
              ? ["Groups", "Classes"]
              : module === "people"
                ? ["Accounts", "Invitations"]
                : ["Charges", "Payment history"]
          }
          value={
            source === "people"
              ? "Accounts"
              : source === "invitations"
                ? "Invitations"
                : source === "classes"
                  ? "Classes"
                  : source === "groups"
                    ? "Groups"
                    : source === "paymentHistory"
                      ? "Payment history"
                      : "Charges"
          }
          onChange={(v) =>
            setSource(
              v === "Accounts"
                ? "people"
                : v === "Invitations"
                  ? "invitations"
                  : v === "Classes"
                    ? "classes"
                    : v === "Groups"
                      ? "groups"
                      : v === "Payment history"
                        ? "paymentHistory"
                        : "payments",
            )
          }
        />
      )}
      {module === "ads" ? <AdComposerLauncher /> : <WorkflowPanel module={module} />}
      <RecordList key={source} module={source} detail={source === module ? detail : undefined} />
    </>
  );
}
function RecordList({
  module,
  detail,
  options = {},
  learnerId,
  compact = false,
}: {
  module: ReadModule;
  detail?: string;
  options?: ReadOptions;
  learnerId?: string;
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [outstanding, setOutstanding] = useState("All requests");
  const [mode, setMode] = useState("Agenda");
  const [month, setMonth] = useState(() => schoolDate(Date.now()).slice(0, 7));
  const [day, setDay] = useState("All days");
  const [selected, setSelected] = useState<string>();
  const [manage, setManage] = useState("Published records");
  const { account } = useSchool();
  const staff = account?.roles.some((r) => ["Teacher", "Principal", "Administrator"].includes(r));
  const result = useRecords(
    module,
    {
      ...options,
      ...(manage === "Staff workflow records" ? { manage: true } : {}),
      ...(search ? { search } : {}),
      ...(category !== "All categories" ? { category } : {}),
      ...(outstanding === "Outstanding" ? { outstandingOnly: true } : {}),
      ...(module === "calendar" && mode === "Month" ? monthRange(month) : {}),
    },
    learnerId,
  );
  const categories =
    module === "messages" ? NOTICE_CATEGORIES : module === "resources" ? RESOURCE_CATEGORIES : [];
  if (selected)
    return (
      <>
        <Button secondary title="Back to list" onPress={() => setSelected(undefined)} />
        <RecordDetails module={module} id={selected} options={options} learnerId={learnerId} />
      </>
    );
  const rows = result.data.records.filter(
    (r) =>
      module !== "calendar" ||
      mode !== "Month" ||
      day === "All days" ||
      eventDays(r, month).includes(day),
  );
  return (
    <>
      {!compact && (
        <Field label="Search records" value={search} onChangeText={setSearch} maxLength={200} />
      )}
      {categories.length > 0 && (
        <Chips items={["All categories", ...categories]} value={category} onChange={setCategory} />
      )}
      {module === "forms" && (
        <Chips
          items={["All requests", "Outstanding"]}
          value={outstanding}
          onChange={setOutstanding}
        />
      )}
      {staff && ["messages", "calendar", "resources"].includes(module) && (
        <Chips
          items={["Published records", "Staff workflow records"]}
          value={manage}
          onChange={setManage}
        />
      )}
      {module === "calendar" && (
        <>
          <Chips items={["Agenda", "Month"]} value={mode} onChange={setMode} />
          {mode === "Month" && (
            <>
              <View style={s.row}>
                <Button
                  secondary
                  title="Previous"
                  onPress={() => {
                    setMonth(moveMonth(month, -1));
                    setDay("All days");
                  }}
                />
                <Text weight="bold">{month}</Text>
                <Button
                  secondary
                  title="Next"
                  onPress={() => {
                    setMonth(moveMonth(month, 1));
                    setDay("All days");
                  }}
                />
              </View>
              <Button secondary title="All days" onPress={() => setDay("All days")} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <Text key={d} style={{ width: "13%", fontSize: 11, textAlign: "center" }}>
                    {d}
                  </Text>
                ))}
                {monthCells(month).map((date, i) =>
                  date ? (
                    <Pressable
                      key={date}
                      accessibilityRole="button"
                      accessibilityLabel={date}
                      accessibilityState={{ selected: day === date }}
                      onPress={() => setDay(date)}
                      style={{
                        width: "13%",
                        paddingVertical: 10,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: day === date ? colors.primary : colors.border,
                        borderRadius: 8,
                      }}
                    >
                      <Text>
                        {Number(date.slice(-2))}
                        {result.data.records.some((r) => eventDays(r, month).includes(date))
                          ? " *"
                          : ""}
                      </Text>
                    </Pressable>
                  ) : (
                    <View key={i} style={{ width: "13%" }} />
                  ),
                )}
              </View>
            </>
          )}
        </>
      )}
      {result.status === "loading" && (
        <ActivityIndicator accessibilityLabel="Loading records" color={colors.primary} />
      )}
      {result.status === "ready" && !rows.length && (
        <Empty
          title="No matching records"
          body={
            result.canLoadMore
              ? "Load more to continue searching all records."
              : "No records match your account and selection."
          }
        />
      )}
      {rows.map((r) =>
        detail ? (
          <Row key={r.id} record={r} path={`/${detail}/${r.id}`} />
        ) : (
          <Row key={r.id} record={r} onOpen={() => setSelected(r.id)} />
        ),
      )}
      {(result.canLoadMore || result.loadingMore) && (
        <Button
          secondary
          title={result.loadingMore ? "Loading..." : "Load more"}
          disabled={result.loadingMore}
          onPress={result.loadMore}
        />
      )}
    </>
  );
}
function RecordDetails({
  module,
  id,
  options = {},
  learnerId,
}: {
  module: ReadModule;
  id: string;
  options?: ReadOptions;
  learnerId?: string;
}) {
  const result = useDetail(module, id, options, learnerId);
  const item = result.data?.record;
  const receipt = useReceipt();
  const { offline } = useSchool();
  const [failure, setFailure] = useState("");
  const [pending, setPending] = useState(false);
  const [section, setSection] = useState("");
  async function save(acknowledge: boolean) {
    if (!item || offline) return;
    setPending(true);
    setFailure("");
    try {
      await receipt({ noticeId: item.id as Id<"notices">, acknowledge });
    } catch {
      setFailure("Could not save your response. Please try again.");
    } finally {
      setPending(false);
    }
  }
  if (result.status === "error")
    return (
      <>
        <Empty
          title="Record unavailable"
          body="This record may no longer be available for your account and selection."
        />
        <DataFailure retry={result.retry} />
      </>
    );
  if (!item)
    return <ActivityIndicator accessibilityLabel="Loading record" color={colors.primary} />;
  const related = result.data?.related ?? [];
  const current = related.find((tab) => tab.module === section) ?? related[0];
  return (
    <>
      {module === "ads" && (
        <>
          <AdPreview record={item} />
          <AdComposer adId={id} />
        </>
      )}
      <WorkflowPanel
        module={module}
        itemId={id}
        learnerId={learnerId}
        hide={module === "ads" ? ["adSave"] : []}
      />
      {module === "messages" && related.some((r) => r.module === "noticeReceipts") && (
        <Boundary>
          <NotificationPanel noticeId={id} />
        </Boundary>
      )}
      <Row record={item} />
      <Card>
        <Text>{item.body || "No additional information has been provided."}</Text>
        {item.fields?.map((f, i) => (
          <Text key={i}>
            <Text weight="bold">{f.label}: </Text>
            {f.value}
          </Text>
        ))}
      </Card>
      {module === "messages" && item.canMarkRead && (
        <>
          <Button
            title={item.read ? "Read" : "Mark as read"}
            disabled={offline || pending || item.read}
            onPress={() => void save(false)}
          />
          {item.requiresAcknowledgement && item.canAcknowledge && (
            <Button
              title={item.acknowledged ? "Acknowledged" : "Acknowledge"}
              disabled={offline || pending || item.acknowledged}
              onPress={() => void save(true)}
            />
          )}
        </>
      )}
      {module === "calendar" && (
        <Button
          title="Add to calendar (.ics)"
          onPress={() => {
            void shareEvent(item).catch(() =>
              setFailure("Could not export this event on this device."),
            );
          }}
        />
      )}
      {failure && <Feedback error message={failure} />}
      {related.length > 0 && (
        <>
          <Chips
            items={related.map((t) => t.title)}
            value={current?.title ?? ""}
            onChange={(title) => setSection(related.find((t) => t.title === title)?.module ?? "")}
          />
          {current && (
            <Boundary key={`${current.module}:${id}`}>
              <RecordList
                module={current.module}
                learnerId={current.learnerId}
                options={current.parentId ? { parentId: current.parentId } : {}}
                compact
              />
            </Boundary>
          )}
        </>
      )}
      {module === "payments" && <Feedback message="Payments are not yet enabled." />}
    </>
  );
}
function Detail({
  module,
  title,
}: {
  module: SchoolModule;
  title: string;
  receiptEnabled?: boolean;
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen title={title} back>
      <Boundary>
        <RecordDetails key={id} module={module} id={id} />
      </Boundary>
    </Screen>
  );
}
function Dashboard() {
  const result = useDashboard();
  return result.status === "error" ? (
    <DataFailure retry={result.retry} />
  ) : result.status !== "ready" ? (
    <Text accessibilityRole="progressbar">Updating your school summary...</Text>
  ) : (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {[
        ["Unread updates", result.data?.unread],
        ["Pending actions", result.data?.pendingActions],
        ["Upcoming events", result.data?.upcomingEvents],
        [
          "Amount due",
          result.data?.amountDueCents === null
            ? null
            : `R ${((result.data?.amountDueCents ?? 0) / 100).toFixed(2)}`,
        ],
      ]
        .filter(([, v]) => v !== null)
        .map(([label, value]) => (
          <Card key={label} style={{ minWidth: 140, flex: 1 }}>
            <Text style={s.small}>{label}</Text>
            <Text weight="bold" style={{ fontSize: 24 }}>
              {value}
            </Text>
          </Card>
        ))}
    </View>
  );
}
export function ParentHome() {
  const { account } = useSchool();
  const grants = accessRolesFor(account?.roles ?? [], !!account?.learners.length);
  const school = useModule("home");
  const messages = useModule("messages");
  return (
    <Screen
      title={`Hello, ${account?.name.split(" ")[0] ?? ""}`}
      subtitle="A little closer to their school day."
    >
      <LinearGradient
        colors={[colors.deepRed, colors.primary]}
        style={{ padding: 24, borderRadius: 24, gap: 12 }}
      >
        <Text weight="bold" style={{ color: "white", fontSize: 22 }}>
          {school.data?.records[0]?.title ?? "Your school, connected"}
        </Text>
        <Text style={{ color: "white" }}>
          {school.data?.records[0]?.subtitle ?? "Honor Before Honours"}
        </Text>
      </LinearGradient>
      <Boundary>
        <AdCarousel />
        <AdPopup />
      </Boundary>
      <ChildPicker />
      <Boundary>
        <Dashboard />
      </Boundary>
      <View style={{ gap: 12 }}>
        {canAccessModule(grants, "payments", account?.disabledModules) && (
          <LinkRow title="Payments" icon="wallet-outline" href="/payments" />
        )}
        {canAccessModule(grants, "forms", account?.disabledModules) && (
          <LinkRow title="Forms & consent" icon="checkbox-outline" href="/forms" />
        )}
        {canAccessModule(grants, "resources", account?.disabledModules) && (
          <LinkRow title="Resources" icon="folder-open-outline" href="/resources" />
        )}
        {canAccessModule(grants, "contact", account?.disabledModules) && (
          <LinkRow title="Contact school" icon="chatbubbles-outline" href="/contact" />
        )}
      </View>
      {canAccessModule(grants, "messages", account?.disabledModules) && (
        <Heading title="Latest updates" />
      )}
      <QueryState result={school} />
      <QueryState result={messages} />
      {messages.data?.records.slice(0, 3).map((r) => (
        <Row key={r.id} record={r} path={`/notice/${r.id}`} />
      ))}
      {canAccessModule(grants, "messages", account?.disabledModules) && (
        <Button secondary title="All updates" onPress={() => open("/messages")} />
      )}
    </Screen>
  );
}
export function UpdatesScreen() {
  return <ModuleList module="messages" title="School updates" detail="notice" />;
}
export function NoticeScreen() {
  return <Detail module="messages" title="Notice" receiptEnabled />;
}
export function CalendarScreen() {
  return <ModuleList module="calendar" title="School calendar" detail="event" />;
}
export function EventScreen() {
  return <Detail module="calendar" title="School event" />;
}
export function ChildrenScreen() {
  return <ModuleList module="children" title="Your children" detail="learner" />;
}
export function LearnerScreen() {
  return <Detail module="children" title="Learner" />;
}
export function PaymentsScreen() {
  return <ModuleList module="payments" title="Payments" detail="payment" />;
}
export function PaymentScreen() {
  return <Detail module="payments" title="School charge" />;
}
export function FormsScreen() {
  return <ModuleList module="forms" title="Forms & consent" />;
}
export function ResourcesScreen() {
  return <ModuleList module="resources" title="Resources" detail="document" />;
}
export function DocumentScreen() {
  return <Detail module="resources" title="School resource" />;
}
export function ContactScreen() {
  return <ModuleList module="contact" title="Contact school" detail="enquiry" />;
}
export function EnquiryScreen() {
  return <Detail module="contact" title="School enquiry" />;
}
export function ProfileScreen() {
  const { account, signOut, signOutEverywhere } = useSchool();
  const [error, setError] = useState("");
  async function logout(all: boolean) {
    try {
      await (all ? signOutEverywhere() : signOut());
    } catch {
      setError("Could not sign out. Please try again.");
    }
  }
  return (
    <Screen title="Your profile">
      <Card>
        <Text weight="bold">{account?.name}</Text>
        <Text>{account?.email}</Text>
        <Text>{account?.learners.map((l) => l.name).join(", ")}</Text>
      </Card>
      <WorkflowPanel module="profile" />
      <Boundary>
        <NotificationPanel />
      </Boundary>
      {error && <Feedback error message={error} />}
      <Button title="Sign out" onPress={() => void logout(false)} />
      <Button secondary title="Sign out on all devices" onPress={() => void logout(true)} />
    </Screen>
  );
}
export function MoreScreen() {
  const { account } = useSchool();
  const grants = accessRolesFor(account?.roles ?? [], !!account?.learners.length);
  const [error, setError] = useState("");
  return (
    <Screen title="More from your school">
      <LinkRow
        title="Uniform store"
        icon="shirt-outline"
        onPress={() =>
          void Linking.openURL(schoolConfig.clothingStoreUrl).catch(() =>
            setError("Could not open the uniform store."),
          )
        }
      />
      {error && <Feedback error message={error} />}
      {(
        [
          ["payments", "Payments"],
          ["forms", "Forms & consent"],
          ["resources", "Resources"],
          ["contact", "Contact school"],
          ["groups", "Groups & classes"],
          ["attendance", "Attendance"],
          ["conduct", "Conduct"],
          ["reports", "Reports"],
          ["people", "People"],
          ["settings", "Settings"],
          ["audit", "Audit log"],
          ["ads", "Ad Center"],
        ] as const
      )
        .filter(([module]) => canAccessModule(grants, module, account?.disabledModules))
        .map(([module, title]) => (
          <LinkRow
            key={module}
            title={title}
            icon="folder-open-outline"
            href={`/${module}` as Href}
          />
        ))}
      <LinkRow title="Your profile" icon="person-outline" href="/profile" />
    </Screen>
  );
}
