import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Switch, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { children, money, visibleNotices, type SchoolEvent } from "@school-connect/core";
import { colors } from "@/theme/school";
import { useSchool } from "./store";
import { consentError, familyView, markNotice } from "./parent-model";
import {
  Badge,
  Button,
  Card,
  ChildPicker,
  Chips,
  Empty,
  Feedback,
  Field,
  Heading,
  Icon,
  LinkRow,
  Screen,
  Text,
  s,
  type IconName,
} from "./ui";

function open(path: string) {
  router.push(path as Href);
}
function EventRow({ event }: { event: SchoolEvent }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => open(`/event/${event.id}`)} style={s.row}>
      <View style={[s.avatar, { width: 52, height: 58 }]}>
        <Text weight="bold" style={{ color: colors.deepRed, fontSize: 20 }}>
          {event.day}
        </Text>
        <Text style={{ fontSize: 9, lineHeight: 12 }}>{event.month}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text weight="semibold">{event.title}</Text>
        <Text style={s.small}>
          {event.time} · {event.audience}
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} />
    </Pressable>
  );
}

export function ParentHome() {
  const { state, child } = useSchool();
  const view = familyView(state, child);
  const actions: { title: string; icon: IconName; path: string }[] = [
    { title: "Payments", icon: "wallet-outline", path: "/payments" },
    { title: "Consent", icon: "checkbox-outline", path: "/forms" },
    { title: "Resources", icon: "folder-open-outline", path: "/resources" },
    { title: "Contact", icon: "chatbubbles-outline", path: "/contact" },
  ];
  return (
    <Screen title="Hello, Jamie 👋" subtitle="A little closer to their school day.">
      <ChildPicker />
      <LinearGradient
        colors={["#ae252c", "#711b26"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 26, padding: 24, gap: 22, overflow: "hidden" }}
      >
        <View
          style={{
            position: "absolute",
            right: -35,
            top: -40,
            width: 185,
            height: 185,
            borderWidth: 28,
            borderColor: "#ffffff08",
            borderRadius: 100,
          }}
        />
        <View style={s.row}>
          <Text weight="semibold" style={{ color: "#ffe8e5", flex: 1, fontSize: 12 }}>
            YOUR FAMILY, AT A GLANCE
          </Text>
          <Icon name="sparkles-outline" color={colors.gold} />
        </View>
        <View>
          <Text style={{ color: "#ffe8e5", fontSize: 12 }}>Activity payments outstanding</Text>
          <Text weight="bold" style={{ color: "white", fontSize: 37, lineHeight: 52 }}>
            {money(view.amountDue)}
          </Text>
          <Text style={{ color: "#ffe8e5", fontSize: 11 }}>
            {view.amountDue ? "Grade 4 excursion · Due 20 October" : "You're all caught up"}
          </Text>
        </View>
        <View style={[s.row, { borderTopWidth: 1, borderTopColor: "#ffffff25", paddingTop: 16 }]}>
          {[
            { value: view.unread, label: "Unread updates", path: "/messages" },
            { value: view.consentDue, label: "Forms to sign", path: "/forms" },
            { value: view.events.length, label: "Upcoming events", path: "/calendar" },
          ].map((item) => (
            <Pressable
              key={item.path}
              accessibilityRole="button"
              onPress={() => open(item.path)}
              style={{ flex: 1, minHeight: 48 }}
            >
              <Text weight="bold" style={{ color: "white", fontSize: 22, lineHeight: 30 }}>
                {item.value}
              </Text>
              <Text style={{ color: "#ffe8e5", fontSize: 10 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>
      <Heading title="Make it a quick visit" />
      <View style={[s.row, { alignItems: "flex-start" }]}>
        {actions.map((item) => (
          <Pressable
            key={item.path}
            accessibilityRole="button"
            onPress={() => open(item.path)}
            style={{ flex: 1, alignItems: "center", gap: 8 }}
          >
            <View
              style={[
                s.iconTile,
                {
                  width: 58,
                  height: 58,
                  borderRadius: 20,
                  backgroundColor: "white",
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Icon name={item.icon} size={25} />
            </View>
            <Text weight="semibold" style={{ fontSize: 10 }}>
              {item.title}
            </Text>
          </Pressable>
        ))}
      </View>
      {view.consentDue > 0 && (
        <Card style={{ backgroundColor: colors.goldSoft, borderColor: "#f6e5b2" }}>
          <View style={s.row}>
            <Icon name="alert-circle-outline" color={colors.deepRed} />
            <Text weight="bold" style={{ flex: 1 }}>
              An adventure needs your yes
            </Text>
            <Badge label="20 OCT" />
          </View>
          <Text style={s.muted}>
            Emma&apos;s excursion consent is ready. It only takes a moment.
          </Text>
          <Button secondary title="Review consent form" onPress={() => open("/forms")} />
        </Card>
      )}
      <Heading title="What's happening" action="Calendar" onPress={() => open("/calendar")} />
      <Card>
        {view.events.slice(0, 2).map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </Card>
      <Heading title="Latest from school" action="View all" onPress={() => open("/messages")} />
      <Card>
        {view.notices.slice(0, 2).map((notice) => (
          <LinkRow
            key={notice.id}
            title={notice.title}
            subtitle={`${notice.category} · ${notice.date}`}
            icon="newspaper-outline"
            href={`/notice/${notice.id}` as Href}
            badge={!notice.read ? "NEW" : undefined}
          />
        ))}
      </Card>
    </Screen>
  );
}

export function UpdatesScreen() {
  const { state, child } = useSchool();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [unread, setUnread] = useState(false);
  const notices = familyView(state, child).notices.filter(
    (n) =>
      (category === "All" || n.category === category) &&
      (!unread || !n.read) &&
      `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Screen title="School updates" subtitle="The news that matters to your family.">
      <ChildPicker />
      <Field
        label="Search updates"
        placeholder="Search a topic or announcement"
        value={query}
        onChangeText={setQuery}
      />
      <Chips
        items={["All", "Academic", "Sport", "General", "Events"]}
        value={category}
        onChange={setCategory}
      />
      <View style={s.row}>
        <Text style={{ flex: 1 }}>Only unread updates</Text>
        <Switch
          accessibilityLabel="Only unread updates"
          value={unread}
          onValueChange={setUnread}
          trackColor={{ true: colors.primary }}
        />
      </View>
      {notices.length === 0 && (
        <Empty
          title="All clear here"
          body="Try another filter or check back for new school updates."
        />
      )}
      {notices.map((notice) => (
        <Card key={notice.id}>
          <View style={s.row}>
            <Badge label={notice.category} />
            <Text style={[s.small, { flex: 1, textAlign: "right" }]}>{notice.date}</Text>
            {!notice.read && (
              <View
                accessibilityLabel="Unread"
                style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }}
              />
            )}
          </View>
          <Text weight="bold" style={{ fontSize: 18, lineHeight: 26 }}>
            {notice.title}
          </Text>
          <Text numberOfLines={2} style={s.muted}>
            {notice.body}
          </Text>
          <LinkRow
            title="Read update"
            subtitle={notice.author}
            icon="arrow-forward-outline"
            href={`/notice/${notice.id}` as Href}
          />
        </Card>
      ))}
    </Screen>
  );
}
export function NoticeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, update } = useSchool();
  const notice = visibleNotices(state, "Parent", "all").find((n) => n.id === id);
  useEffect(() => {
    if (notice && !notice.read) update((current) => markNotice(current, id));
  }, [id, notice, update]);
  return (
    <Screen back title="School update">
      {!notice ? (
        <Empty title="Update unavailable" body="This update is not published for parents." />
      ) : (
        <>
          <View style={s.row}>
            <Badge label={notice.category} />
            <Text style={s.small}>{notice.date}</Text>
          </View>
          <Text weight="bold" style={{ fontSize: 24, lineHeight: 34 }}>
            {notice.title}
          </Text>
          <Text style={s.muted}>
            {notice.author} · {notice.audience}
          </Text>
          <Card>
            <Text style={{ lineHeight: 26 }}>{notice.body}</Text>
          </Card>
          {notice.attachment && (
            <Card>
              <LinkRow
                title={notice.attachment}
                subtitle="Open sample attachment preview"
                icon="document-text-outline"
                onPress={() =>
                  open(`/document/attachment?title=${encodeURIComponent(notice.attachment!)}`)
                }
              />
            </Card>
          )}
          {notice.action === "consent" && (
            <Button title="Review excursion consent" onPress={() => open("/forms")} />
          )}
          <Button
            secondary
            disabled={notice.acknowledged}
            title={notice.acknowledged ? "Acknowledged ✓" : "Acknowledge update"}
            onPress={() => update((current) => markNotice(current, id, true))}
          />
        </>
      )}
    </Screen>
  );
}

export function CalendarScreen() {
  const { state, child } = useSchool();
  const [day, setDay] = useState<number | null>(null);
  const [mode, setMode] = useState("Month");
  const events = familyView(state, child).events.filter((e) => day === null || e.day === day);
  return (
    <Screen title="Your school calendar" subtitle="October 2026 · Term 4">
      <ChildPicker />
      <Chips items={["Month", "Agenda"]} value={mode} onChange={setMode} />
      {mode === "Month" && (
        <Card>
          <Heading title="October 2026" action="All dates" onPress={() => setDay(null)} />
          <View style={{ flexDirection: "row" }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
              <Text
                key={i}
                weight="semibold"
                style={{
                  width: "14.2857%",
                  textAlign: "center",
                  color: colors.muted,
                  fontSize: 11,
                }}
              >
                {label}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: 35 }, (_, i) => (i < 3 || i > 33 ? null : i - 2)).map(
              (date, i) => (
                <Pressable
                  key={i}
                  disabled={!date}
                  accessibilityRole={date ? "button" : undefined}
                  accessibilityLabel={date ? `October ${date}, 2026` : undefined}
                  accessibilityState={{ selected: date === day }}
                  onPress={() => setDay(date)}
                  style={{
                    width: "14.2857%",
                    minHeight: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: date === day ? colors.deepRed : "transparent",
                    borderRadius: 14,
                  }}
                >
                  <Text
                    weight={date === 14 ? "bold" : "regular"}
                    style={{ color: date === day ? "white" : colors.text }}
                  >
                    {date}
                  </Text>
                  {date && familyView(state, child).events.some((e) => e.day === date) ? (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: date === day ? colors.gold : colors.primary,
                      }}
                    />
                  ) : null}
                </Pressable>
              ),
            )}
          </View>
        </Card>
      )}
      <Heading
        title={day ? `October ${day}` : "Coming up"}
        action={day ? "Clear date" : undefined}
        onPress={() => setDay(null)}
      />
      {events.length ? (
        <Card>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </Card>
      ) : (
        <Empty
          title="A little breathing room"
          body="No school events on this date for the selected child."
        />
      )}
    </Screen>
  );
}
export function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useSchool();
  const event = state.events.find((e) => e.id === id);
  return (
    <Screen back title="Event details">
      {event ? (
        <>
          <Badge label={event.category} />
          <Text weight="bold" style={{ fontSize: 25, lineHeight: 35 }}>
            {event.title}
          </Text>
          <Card>
            <LinkRow
              title={`${event.day} October 2026`}
              subtitle={event.time}
              icon="calendar-outline"
              onPress={() => open("/calendar")}
            />
            <View style={s.row}>
              <Icon name="location-outline" />
              <Text style={{ flex: 1 }}>{event.location}</Text>
            </View>
            <Text style={s.muted}>
              For {event.audience.toLowerCase()} families. Please check the related update for what
              to bring.
            </Text>
          </Card>
          {id === "trip" && (
            <>
              <Button title="Excursion consent" onPress={() => open("/forms")} />
              <Button secondary title="View activity payment" onPress={() => open("/payments")} />
            </>
          )}
        </>
      ) : (
        <Empty title="Event unavailable" body="Return to the calendar to find upcoming events." />
      )}
    </Screen>
  );
}

export function ChildrenScreen() {
  const { child } = useSchool();
  return (
    <Screen title="Your children" subtitle="Their school journey, in one place.">
      <ChildPicker />
      {children
        .filter((c) => child === "all" || child === c.id)
        .map((c) => (
          <Card key={c.id}>
            <View style={s.row}>
              <View style={[s.avatar, { width: 60, height: 60, borderRadius: 22 }]}>
                <Text weight="bold" style={{ color: colors.deepRed, fontSize: 20 }}>
                  {c.initials}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text weight="bold" style={{ fontSize: 18 }}>
                  {c.name}
                </Text>
                <Text style={s.muted}>
                  {c.grade} · Class {c.className}
                </Text>
              </View>
            </View>
            <Text style={s.small}>Class teacher · {c.teacher}</Text>
            <Button
              secondary
              title="View learner profile"
              onPress={() => open(`/learner/${c.id}`)}
            />
          </Card>
        ))}
    </Screen>
  );
}
export function LearnerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useSchool();
  const c = children.find((item) => item.id === id);
  const [section, setSection] = useState("Overview");
  return (
    <Screen
      back
      title={c?.name ?? "Learner unavailable"}
      subtitle={c && `${c.grade} · ${c.className}`}
    >
      {c ? (
        <>
          <Chips
            items={["Overview", "Reports", "Attendance", "Conduct", "Timetable"]}
            value={section}
            onChange={setSection}
          />
          {section === "Overview" && (
            <Card>
              <Badge label="Linked learner" good />
              <Text weight="bold">A growing school journey</Text>
              <Text style={s.muted}>Class teacher: {c.teacher}</Text>
              <Text style={s.muted}>House: Red · Academic year: 2026</Text>
              <Text style={s.small}>Sample learner details · Parent view is read-only.</Text>
            </Card>
          )}
          {section === "Reports" && (
            <>
              <Card>
                <LinkRow
                  title="Term 3 learning report"
                  subtitle="Published sample · 2026"
                  icon="document-text-outline"
                  onPress={() =>
                    open(
                      `/document/report?title=${encodeURIComponent(`${c.name} · Term 3 report`)}`,
                    )
                  }
                />
              </Card>
              {state.reportReleased ? (
                <Card>
                  <LinkRow
                    title="Term 4 learning report"
                    subtitle="Published in demo"
                    icon="document-text-outline"
                    onPress={() =>
                      open(
                        `/document/report?title=${encodeURIComponent(`${c.name} · Term 4 report`)}`,
                      )
                    }
                  />
                </Card>
              ) : (
                <Empty
                  title="Term 4 report is on its way"
                  body="Only published reports appear in your parent view."
                />
              )}
            </>
          )}
          {section === "Attendance" && (
            <Card>
              <Badge
                label={
                  state.attendance[c.name] === undefined
                    ? "No record available"
                    : state.attendance[c.name]
                      ? "Present"
                      : "Absent"
                }
                good={state.attendance[c.name]}
              />
              <Text weight="bold">14 October 2026</Text>
              <Text style={s.muted}>
                This is a sample daily attendance record. Contact the school office for any
                corrections.
              </Text>
            </Card>
          )}
          {section === "Conduct" &&
            (state.conduct.filter((item) => item.child === c.name).length ? (
              state.conduct
                .filter((item) => item.child === c.name)
                .map((item, i) => (
                  <Card key={i}>
                    <Badge label={item.type} good />
                    <Text weight="bold">{item.title}</Text>
                    <Text style={s.small}>A moment to celebrate · Sample record</Text>
                  </Card>
                ))
            ) : (
              <Empty
                title="No conduct records"
                body="New recognitions will appear here when shared by the school."
              />
            ))}
          {section === "Timetable" && (
            <Card>
              <Text weight="bold">Wednesday · Sample timetable</Text>
              {[
                "08:00 · Registration",
                "08:15 · Mathematics",
                "09:15 · English",
                "10:15 · Break",
                "10:45 · Life Skills",
                "12:00 · Creative Arts",
                "13:00 · End of day",
              ].map((item) => (
                <Text key={item} style={s.muted}>
                  {item}
                </Text>
              ))}
            </Card>
          )}
        </>
      ) : (
        <Empty title="Learner not found" body="Choose a linked learner from Children." />
      )}
    </Screen>
  );
}

export function PaymentsScreen() {
  const { state, child } = useSchool();
  const view = familyView(state, child);
  return (
    <Screen back title="Payments" subtitle="A clear picture of school expenses.">
      <ChildPicker />
      <LinearGradient
        colors={[colors.deepRed, "#ac2830"]}
        style={{ borderRadius: 24, padding: 24, gap: 8 }}
      >
        <Text style={{ color: "#ffe8e5" }}>Activity balance</Text>
        <Text weight="bold" style={{ color: "white", fontSize: 34, lineHeight: 48 }}>
          {money(view.amountDue)}
        </Text>
        <Text style={{ color: "#ffe8e5", fontSize: 11 }}>
          Frontend demo · No real money is collected
        </Text>
      </LinearGradient>
      <Heading title="Activity payments" />
      {child === "all" || child === "emma" ? (
        <Card>
          <LinkRow
            title="Botanical gardens excursion"
            subtitle="Emma · Due 20 October · R250.00"
            icon="leaf-outline"
            href="/payment/excursion"
            badge={state.payment}
          />
        </Card>
      ) : (
        <Empty
          title="No activity payments due"
          body="There are no activity charges for Noah in this demo."
        />
      )}
      <Heading title="Payment history" />
      <Card>
        <LinkRow
          title="October school fees"
          subtitle="Family · R2,800.00 · 1 October"
          icon="receipt-outline"
          href="/payment/october"
          badge="Paid"
        />
      </Card>
    </Screen>
  );
}
export function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, processing: busy, simulatePayment } = useSchool();
  const [checkout, setCheckout] = useState(false);
  const known = id === "excursion" || id === "october";
  const historical = id === "october";
  const paid = historical || state.payment === "Paid";
  return (
    <Screen back title={paid ? "Payment receipt" : "Activity payment"}>
      {!known ? (
        <Empty title="Payment unavailable" body="Choose a payment from your activity list." />
      ) : (
        <>
          <Card>
            <Icon
              name={paid ? "checkmark-circle-outline" : "wallet-outline"}
              size={42}
              color={paid ? "#246442" : colors.primary}
            />
            <Badge label={historical ? "Paid" : state.payment} good={paid} />
            <Text weight="bold" style={{ fontSize: 21 }}>
              {historical ? "October school fees" : "Botanical gardens excursion"}
            </Text>
            <Text style={s.muted}>
              {historical ? "Family school fees" : "Emma Williams · Grade 4"}
            </Text>
            <Text weight="bold" style={{ fontSize: 34, lineHeight: 46 }}>
              {money(historical ? 2800 : 250)}
            </Text>
            <Text style={s.small}>
              {paid
                ? `Demo receipt · WGJS-${historical ? "OCT-001" : "TRIP-002"}`
                : "Due 20 October 2026"}
            </Text>
          </Card>
          {paid ? (
            <Feedback message="Recorded in this demo. This receipt is a sample and is not proof of a real payment." />
          ) : (
            <>
              {state.payment === "Failed" && (
                <Feedback
                  error
                  message="The simulated payment failed. Nothing was charged. You can retry."
                />
              )}
              {state.payment === "Pending verification" && (
                <Feedback message="Pending demo verification. The balance remains outstanding until marked paid." />
              )}
              {checkout ? (
                <Card>
                  <Text weight="bold">Confirm demo payment</Text>
                  <Text style={s.muted}>
                    Simulate a R250 activity payment. No payment details are required and no money
                    will move.
                  </Text>
                  {busy && (
                    <ActivityIndicator
                      color={colors.primary}
                      accessibilityLabel="Simulating payment"
                    />
                  )}
                  <Button
                    disabled={busy}
                    title={busy ? "Verifying…" : "Simulate payment"}
                    onPress={simulatePayment}
                  />
                  <Button
                    secondary
                    disabled={busy}
                    title="Cancel"
                    onPress={() => setCheckout(false)}
                  />
                </Card>
              ) : (
                <Button
                  title={
                    state.payment === "Failed" ? "Retry demo payment" : "Continue to demo checkout"
                  }
                  onPress={() => setCheckout(true)}
                />
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

export function FormsScreen() {
  const { state, child, update, consentPhone, setConsentPhone } = useSchool();
  const [phone, setPhone] = useState(consentPhone);
  const [permission, setPermission] = useState(false);
  const [error, setError] = useState("");
  return (
    <Screen back title="Forms & consent" subtitle="A little permission for a big adventure.">
      <ChildPicker />
      {child === "noah" ? (
        <Empty title="Nothing to sign" body="No forms are awaiting a response for Noah." />
      ) : (
        <>
          <Card>
            <Badge label={state.consent ? "Submitted" : "Action needed"} good={state.consent} />
            <Text weight="bold" style={{ fontSize: 21 }}>
              Grade 4 excursion consent
            </Text>
            <Text style={s.muted}>Emma Williams · 23 October 2026</Text>
            <Text>
              Botanical gardens · 08:00–14:00. Bring a packed lunch, water bottle and sun hat.
              Response due 20 October.
            </Text>
          </Card>
          {state.consent ? (
            <Card>
              <Icon name="checkmark-circle-outline" color="#246442" size={34} />
              <Text weight="bold">You&apos;re all set, Jamie</Text>
              <Text style={s.muted}>Permission granted for Emma to attend.</Text>
              <Text>Emergency contact: {consentPhone}</Text>
              <Feedback message="Your response is saved for this demo session." />
              <Button
                secondary
                title="View excursion payment"
                onPress={() => open("/payment/excursion")}
              />
            </Card>
          ) : (
            <Card>
              <Field
                label="Emergency contact number"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 082 123 4567"
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: permission }}
                onPress={() => setPermission(!permission)}
                style={[s.row, { minHeight: 52 }]}
              >
                <Icon name={permission ? "checkbox" : "square-outline"} />
                <Text style={{ flex: 1 }}>I give permission for Emma to attend the excursion.</Text>
              </Pressable>
              {!!error && <Feedback error message={error} />}
              <Button
                title="Submit consent"
                onPress={() => {
                  const message = consentError(phone, permission);
                  setError(message);
                  if (!message) {
                    setConsentPhone(phone.trim());
                    update((current) => ({ ...current, consent: true }));
                  }
                }}
              />
              <Text style={s.small}>Local demo response · Resets when the app reloads.</Text>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

export function ResourcesScreen() {
  const { state, child } = useSchool();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const resources = state.resources.filter(
    (item) =>
      (child !== "noah" || !item.title.includes("Grade 4")) &&
      (category === "All" || category === item.category) &&
      item.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Screen back title="School resources" subtitle="The useful things, always close by.">
      <ChildPicker />
      <Field
        label="Search resources"
        value={query}
        onChangeText={setQuery}
        placeholder="Find a newsletter or school document"
      />
      <Chips
        items={["All", "Newsletters", "School documents", "Academic"]}
        value={category}
        onChange={setCategory}
      />
      {resources.length ? (
        resources.map((item, i) => (
          <Card key={item.title}>
            <LinkRow
              title={item.title}
              subtitle={`${item.category} · PDF · ${item.size}`}
              icon="document-text-outline"
              href={`/document/${i}?title=${encodeURIComponent(item.title)}` as Href}
            />
          </Card>
        ))
      ) : (
        <Empty title="No matching resources" body="Try another search or category." />
      )}
    </Screen>
  );
}
export function DocumentScreen() {
  const { title } = useLocalSearchParams<{ title: string }>();
  return (
    <Screen back title="Document preview" subtitle="Sample preview">
      <Card>
        <Icon name="document-text-outline" size={44} />
        <Badge label="SAMPLE" />
        <Text weight="bold" style={{ fontSize: 23, lineHeight: 33 }}>
          {title || "School document"}
        </Text>
        <Text style={s.muted}>Wynberg Girls Junior School · 2026</Text>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Text>
          This is a frontend sample of the document viewing experience. A school document would
          appear here once the resource service is connected.
        </Text>
        <Text style={s.small}>
          PDF download and native PDF rendering are not connected in this demo.
        </Text>
      </Card>
      <Button secondary title="Back to resources" onPress={() => open("/resources")} />
    </Screen>
  );
}

export function ContactScreen() {
  const { state, update } = useSchool();
  const [compose, setCompose] = useState(false);
  const [department, setDepartment] = useState("School office");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  return (
    <Screen back title="Let's stay connected" subtitle="A direct line to the right school team.">
      <Card>
        <Text weight="bold">How can we help?</Text>
        <Text style={s.muted}>Ask about school life, class activities or your fee statement.</Text>
        <Button
          title={compose ? "Close new enquiry" : "New enquiry"}
          icon="add-outline"
          onPress={() => setCompose(!compose)}
        />
      </Card>
      {compose && (
        <Card>
          <Text weight="bold">Send a message</Text>
          <Chips
            items={["School office", "Finance", "Class teacher", "Sports"]}
            value={department}
            onChange={setDepartment}
          />
          <Field
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            placeholder="What would you like help with?"
          />
          <Field
            label="Your message"
            multiline
            value={body}
            onChangeText={setBody}
            placeholder="Write your enquiry…"
          />
          {!!error && <Feedback error message={error} />}
          <Button
            title="Send demo enquiry"
            onPress={() => {
              if (!subject.trim() || !body.trim()) {
                setError("Add a subject and message before sending.");
                return;
              }
              const id = `enquiry-${Date.now()}`;
              update((current) => ({
                ...current,
                enquiries: [
                  ...current.enquiries,
                  {
                    id,
                    subject: subject.trim(),
                    department,
                    status: "Open",
                    messages: [{ author: "You", body: body.trim() }],
                  },
                ],
              }));
              setCompose(false);
              setSubject("");
              setBody("");
              setError("");
              open(`/enquiry/${id}`);
            }}
          />
          <Text style={s.small}>Saved locally. This message will not be sent to the school.</Text>
        </Card>
      )}
      <Heading title="Your enquiries" />
      <Card>
        {state.enquiries.map((item) => (
          <LinkRow
            key={item.id}
            title={item.subject}
            subtitle={`${item.department} · ${item.messages.length} message${item.messages.length === 1 ? "" : "s"}`}
            icon="chatbubble-ellipses-outline"
            href={`/enquiry/${item.id}` as Href}
            badge={item.status}
          />
        ))}
      </Card>
    </Screen>
  );
}
export function EnquiryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, update } = useSchool();
  const enquiry = state.enquiries.find((item) => item.id === id);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  return (
    <Screen
      back
      title={enquiry?.subject ?? "Enquiry unavailable"}
      subtitle={enquiry && `${enquiry.department} · ${enquiry.status}`}
    >
      {enquiry ? (
        <>
          <Text style={s.small}>Demo conversation · Messages are stored locally only.</Text>
          {enquiry.messages.map((message, i) => (
            <Card
              key={i}
              style={{ backgroundColor: message.author === "You" ? colors.primarySoft : "white" }}
            >
              <Text weight="bold">
                {message.author === "You" ? "Jamie Williams · You" : message.author}
              </Text>
              <Text>{message.body}</Text>
            </Card>
          ))}
          <Card>
            <Field
              label="Reply"
              value={reply}
              onChangeText={setReply}
              multiline
              placeholder="Add to your enquiry…"
            />
            {!!error && <Feedback error message={error} />}
            <Button
              title="Send demo reply"
              onPress={() => {
                if (!reply.trim()) {
                  setError("Write a message before sending.");
                  return;
                }
                update((current) => ({
                  ...current,
                  enquiries: current.enquiries.map((item) =>
                    item.id === id
                      ? {
                          ...item,
                          messages: [...item.messages, { author: "You", body: reply.trim() }],
                        }
                      : item,
                  ),
                }));
                setReply("");
                setError("");
              }}
            />
          </Card>
        </>
      ) : (
        <Empty title="Enquiry not found" body="Return to Contact to view your messages." />
      )}
    </Screen>
  );
}

export function ProfileScreen() {
  const { state, update, outcome, setOutcome, processing } = useSchool();
  const [tools, setTools] = useState(false);
  return (
    <Screen back title="Your profile" subtitle="The family behind the school journey.">
      <Card>
        <View style={s.row}>
          <View style={[s.avatar, { width: 64, height: 64 }]}>
            <Text weight="bold" style={{ fontSize: 22, color: colors.deepRed }}>
              JW
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={{ fontSize: 20 }}>
              Jamie Williams
            </Text>
            <Text style={s.muted}>Parent · Fictional demo account</Text>
          </View>
        </View>
        <Text style={s.small}>jamie.williams@example.com</Text>
      </Card>
      <Heading title="Linked children" />
      <Card>
        {children.map((c) => (
          <LinkRow
            key={c.id}
            title={c.name}
            subtitle={`${c.grade} · ${c.className}`}
            icon="person-outline"
            href={`/learner/${c.id}` as Href}
          />
        ))}
      </Card>
      <Card>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text weight="semibold">School notifications</Text>
            <Text style={s.small}>Demo preference only</Text>
          </View>
          <Switch
            accessibilityLabel="School notifications"
            value={state.notifications}
            onValueChange={(notifications) => update((current) => ({ ...current, notifications }))}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <Text style={s.small}>
          Push notifications and account editing will be available when the backend is connected.
        </Text>
      </Card>
      <Button
        secondary
        title={tools ? "Hide demo controls" : "Demo controls"}
        onPress={() => setTools(!tools)}
      />
      {tools && (
        <Card>
          <Text weight="bold">Payment simulation</Text>
          <Text style={s.small}>Choose the next demo payment result.</Text>
          <Chips
            items={["Paid", "Failed", "Pending verification"]}
            value={outcome}
            onChange={(value) => setOutcome(value as typeof outcome)}
          />
          <Button
            secondary
            disabled={processing}
            title="Reset excursion payment to Due"
            onPress={() => update((current) => ({ ...current, payment: "Due" }))}
          />
          <Text style={s.small}>Reload the app to reset all demo data.</Text>
        </Card>
      )}
    </Screen>
  );
}
export function MoreScreen() {
  return (
    <Screen title="A little more" subtitle="Everything else your family needs.">
      <Card>
        <LinkRow
          title="Payments"
          subtitle="Activity balances & receipts"
          icon="wallet-outline"
          href="/payments"
        />
        <LinkRow
          title="Forms & consent"
          subtitle="Permissions, made simple"
          icon="checkbox-outline"
          href="/forms"
        />
        <LinkRow
          title="Resources"
          subtitle="Newsletters & school documents"
          icon="folder-open-outline"
          href="/resources"
        />
        <LinkRow
          title="Contact the school"
          subtitle="Enquiries & conversations"
          icon="chatbubbles-outline"
          href="/contact"
        />
      </Card>
      <Card>
        <LinkRow
          title="Your profile"
          subtitle="Family details & preferences"
          icon="person-circle-outline"
          href="/profile"
        />
      </Card>
      <Card style={{ backgroundColor: colors.goldSoft }}>
        <Icon name="heart-outline" color={colors.deepRed} />
        <Text weight="bold">Honor Before Honours</Text>
        <Text style={s.muted}>Connected families. A caring school community.</Text>
      </Card>
    </Screen>
  );
}
