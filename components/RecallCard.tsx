import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  useColorScheme,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { RecallItem } from '@/lib/types';
import { useStore } from '@/lib/store';
import PriorityBadge from '@/components/PriorityBadge';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 120;

interface Props {
  item: RecallItem;
  onPress: () => void;
  onRecall: () => void;
  onForget: () => void;
  expanded?: boolean;
}

export default function RecallCard({ item, onPress, onRecall, onForget, expanded }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const category = useStore((s) => s.getCategoryById(item.categoryId));

  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd(() => {
      if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 250 }, () => {
          runOnJS(onRecall)();
        });
      } else if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 250 }, () => {
          runOnJS(onForget)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Recall background (right side, revealed by left swipe)
  const recallBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      -translateX.value,
      [0, 60, 120],
      [0, 0.5, 1],
      'clamp'
    ),
  }));

  const recallIconScale = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          -translateX.value,
          [0, 80, 120],
          [0.5, 0.8, 1.2],
          'clamp'
        ),
      },
    ],
  }));

  // Forget background (left side, revealed by right swipe)
  const forgetBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 60, 120],
      [0, 0.5, 1],
      'clamp'
    ),
  }));

  const forgetIconScale = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, 80, 120],
          [0.5, 0.8, 1.2],
          'clamp'
        ),
      },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      {/* Recall background — left swipe */}
      <Animated.View
        style={[
          styles.swipeBackground,
          styles.swipeBackgroundRight,
          { backgroundColor: colors.success },
          recallBgStyle,
        ]}
      >
        <Animated.View style={recallIconScale}>
          <Ionicons name="checkmark-circle" size={32} color="#fff" />
        </Animated.View>
        <Text style={styles.swipeText}>Recalled</Text>
      </Animated.View>

      {/* Forget background — right swipe */}
      <Animated.View
        style={[
          styles.swipeBackground,
          styles.swipeBackgroundLeft,
          { backgroundColor: colors.destructive ?? '#EF4444' },
          forgetBgStyle,
        ]}
      >
        <Text style={styles.swipeText}>Forgotten</Text>
        <Animated.View style={forgetIconScale}>
          <Ionicons name="refresh-circle" size={32} color="#fff" />
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
              borderColor: colors.borderLight,
            },
            cardAnimatedStyle,
          ]}
        >
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.88}
            style={styles.cardInner}
          >
            <View style={styles.itemLeading}>
              <View style={styles.itemContent}>
                <Text
                  style={[styles.contentText, { color: colors.text }]}
                  numberOfLines={expanded ? undefined : 2}
                >
                  {item.content}
                </Text>

                <View style={styles.itemMetaRow}>
                  <Text
                    style={[styles.itemSource, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {item.source || 'Unknown source'}
                  </Text>
                  <Text style={[styles.metaDivider, { color: colors.textTertiary }]}>
                    •
                  </Text>
                  <Text style={[styles.itemMeta, { color: colors.textTertiary }]}>
                    {(() => {
                      const d = new Date(item.nextReviewDate);
                      const now = new Date();
                      now.setHours(0, 0, 0, 0);
                      const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      if (diff <= 0) return 'Today';
                      if (diff === 1) return 'Tomorrow';
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    })()}
                  </Text>
                </View>

                <View style={styles.itemFooter}>
                  <View
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor:
                          (category?.color ?? colors.tint) + '15',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        { color: category?.color ?? colors.tint },
                      ]}
                    >
                      {category?.name ?? 'Other'}
                    </Text>
                  </View>
                  <PriorityBadge
                    priorityCode={item.priorityCode}
                    priorityLabel={item.priorityLabel}
                    compact
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 18,
    marginBottom: 12,
    position: 'relative',
  },
  swipeBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipeBackgroundRight: {
    justifyContent: 'flex-end',
    paddingRight: 24,
  },
  swipeBackgroundLeft: {
    justifyContent: 'flex-start',
    paddingLeft: 24,
  },
  swipeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardInner: {
    padding: 16,
  },
  itemLeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemContent: {
    flex: 1,
  },
  contentText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  itemSource: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaDivider: {
    fontSize: 13,
  },
  itemMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
