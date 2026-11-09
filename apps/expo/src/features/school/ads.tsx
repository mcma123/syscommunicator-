import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import type { ModuleRecord, PublicAd } from "@school-connect/core/live";
import { colors } from "@/theme/school";
import { Badge, Button, Card, Icon, Text } from "./ui";
import { useAds } from "./store";
import { localStore } from "./local-store";

type SlideAd = Pick<PublicAd, "title" | "caption" | "linkUrl" | "linkLabel"> & {
  media: { url: string; kind: "image" | "video" } | null;
};
const DISMISSED_KEY = "wgjs-ads-dismissed";

function AdVideo({ url, fit }: { url: string; fit: "cover" | "contain" }) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.loop = true;
  });
  // Start once the source is ready; web browsers ignore play() before the media loads.
  useEffect(() => {
    if (player.status === "readyToPlay") player.play();
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") player.play();
    });
    return () => sub.remove();
  }, [player]);
  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit={fit}
        nativeControls={fit === "contain"}
        accessibilityLabel="School video"
      />
    </View>
  );
}

function AdMedia({ ad, fit = "cover" }: { ad: SlideAd; fit?: "cover" | "contain" }) {
  if (!ad.media) return <View style={[StyleSheet.absoluteFill, styles.empty]} />;
  return ad.media.kind === "video" ? (
    <AdVideo url={ad.media.url} fit={fit} />
  ) : (
    <Image
      source={{ uri: ad.media.url }}
      style={StyleSheet.absoluteFill}
      contentFit={fit}
      accessibilityLabel={ad.title}
    />
  );
}

function AdButton({ ad }: { ad: Pick<SlideAd, "linkUrl" | "linkLabel"> }) {
  if (!ad.linkUrl) return null;
  const url = ad.linkUrl;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={ad.linkLabel || "Learn more"}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      style={styles.cta}
    >
      <Text weight="bold" style={styles.ctaText}>
        {ad.linkLabel || "Learn more"}
      </Text>
      <Icon name="arrow-forward" size={14} color="#3b2600" />
    </Pressable>
  );
}

export function AdSlide({ ad, width }: { ad: SlideAd; width?: number }) {
  return (
    <View style={[styles.slide, width ? { width } : null]}>
      <AdMedia ad={ad} />
      <LinearGradient
        colors={["transparent", "rgba(42,7,12,0.55)", "rgba(42,7,12,0.92)"]}
        style={styles.overlay}
      >
        <View style={styles.eyebrow}>
          <Icon name="megaphone-outline" size={11} color="#ffe2a3" />
          <Text weight="bold" style={styles.eyebrowText}>
            SCHOOL SPOTLIGHT
          </Text>
        </View>
        <Text weight="bold" style={styles.title}>
          {ad.title}
        </Text>
        {ad.caption ? (
          <Text numberOfLines={2} style={styles.caption}>
            {ad.caption}
          </Text>
        ) : null}
        <AdButton ad={ad} />
      </LinearGradient>
    </View>
  );
}

/** Swipeable home spotlight; manual paging only (no automatic motion). */
export function AdCarousel() {
  const { ads } = useAds();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const slides = useMemo(
    () =>
      ads.flatMap((ad) =>
        ad.items.map((item, i) => ({ key: `${ad.id}:${i}`, ad: { ...ad, media: item } })),
      ),
    [ads],
  );
  if (!slides.length) return null;
  return (
    <View
      accessibilityLabel="School spotlight"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ gap: 10 }}
    >
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1)))
          }
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1)))}
          scrollEventThrottle={64}
        >
          {slides.map((slide) => (
            <AdSlide key={slide.key} ad={slide.ad} width={width} />
          ))}
        </ScrollView>
      )}
      {slides.length > 1 && (
        <View style={styles.dots} accessibilityLabel={`Slide ${index + 1} of ${slides.length}`}>
          {slides.map((slide, i) => (
            <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

/** Shows the first unseen popup ad once per device and ad revision. */
export function AdPopup() {
  const { ads } = useAds();
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  useEffect(() => {
    void localStore.getItem(DISMISSED_KEY).then((raw) => {
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        setDismissed(
          Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [],
        );
      } catch {
        setDismissed([]);
      }
    });
  }, []);
  const ad = useMemo(
    () =>
      dismissed === null
        ? undefined
        : ads.find((a) => a.popup && !dismissed.includes(`${a.id}:${a.revision}`)),
    [ads, dismissed],
  );
  const [itemIndex, setItemIndex] = useState(0);
  if (!ad) return null;
  const item = ad.items[Math.min(itemIndex, ad.items.length - 1)] ?? null;
  const close = () => {
    setItemIndex(0);
    const key = `${ad.id}:${ad.revision}`;
    const next = [key, ...(dismissed ?? []).filter((k) => k !== key)].slice(0, 50);
    setDismissed(next);
    void localStore.setItem(DISMISSED_KEY, JSON.stringify(next));
  };
  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.popup} accessibilityViewIsModal>
          <View style={styles.popupMedia}>
            <AdMedia key={item?.url} ad={{ ...ad, media: item }} fit="contain" />
          </View>
          {ad.items.length > 1 && (
            <View style={styles.popupSteps}>
              <Button
                secondary
                title="Previous"
                onPress={() => setItemIndex((i) => (i - 1 + ad.items.length) % ad.items.length)}
              />
              <Text style={{ color: colors.muted }}>
                {itemIndex + 1} of {ad.items.length}
              </Text>
              <Button
                secondary
                title="Next"
                onPress={() => setItemIndex((i) => (i + 1) % ad.items.length)}
              />
            </View>
          )}
          <View style={{ padding: 20, gap: 8 }}>
            <Text weight="bold" style={{ color: colors.primary, fontSize: 11 }}>
              FROM YOUR SCHOOL
            </Text>
            <Text weight="bold" style={{ fontSize: 20 }}>
              {ad.title}
            </Text>
            {ad.caption ? <Text style={{ color: colors.muted }}>{ad.caption}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
              <AdButton ad={ad} />
              <Button secondary title="Got it" onPress={close} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const fieldValue = (r: ModuleRecord, label: string) => {
  const v = r.fields?.find((f) => f.label === label)?.value;
  return v && v !== "Not provided" ? v : null;
};

/** Staff preview of how the ad appears on parents' home screens. */
export function AdPreview({ record }: { record: ModuleRecord }) {
  const ad: SlideAd = {
    title: record.title,
    caption: record.body,
    linkUrl: fieldValue(record, "Link"),
    linkLabel: fieldValue(record, "Button label"),
    media: record.media ?? null,
  };
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text weight="bold">Home banner preview</Text>
        {record.category === "Popup" && <Badge label="Also a popup" />}
      </View>
      {record.media ? (
        <AdSlide ad={ad} />
      ) : (
        <Text style={{ color: colors.muted }}>Add an image or video to see the preview.</Text>
      )}
      {fieldValue(record, "Review note") && (
        <Text style={{ color: colors.primary }}>
          Review note: {fieldValue(record, "Review note")}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  carousel: { borderRadius: 24, overflow: "hidden" },
  slide: {
    aspectRatio: 4 / 3,
    maxHeight: 360,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.deepRed,
  },
  empty: { backgroundColor: colors.deepRed },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 18,
    gap: 6,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  eyebrowText: { color: "#ffe2a3", fontSize: 9, letterSpacing: 1.2 },
  title: { color: "white", fontSize: 20, lineHeight: 26 },
  caption: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 19 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.gold,
  },
  ctaText: { color: "#3b2600", fontSize: 13 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.primary },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(53,34,37,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  popup: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  popupMedia: { aspectRatio: 16 / 9, backgroundColor: "#1a1012" },
  popupSteps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
