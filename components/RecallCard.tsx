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
const SWIPE_THRESHOLD = -120;

interface Props {
  item: RecallItem;
  onPress: () => void;
  onRecall: () => void;
}

export default function RecallCard({ item, onPress, onRecall }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const category = useStore((s) => s.getCategoryById(item.categoryId));

  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 250 }, () => {
          runOnJS(onRecall)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const bgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, 60, 120],
      [0, 0.5, 1]
    ),
  }));

  const checkScale = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          Math.abs(translateX.value),
          [0, 80, 120],
          [0.5, 0.8, 1.2]
        ),
      },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.swipeBackground,
          { backgroundColor: colors.success },
          bgAnimatedStyle,
        ]}
      >
        <Animated.View style={checkScale}>
          <Ionicons name="checkmark-circle" size={32} color="#fff" />
        </Animated.View>
        <Text style={styles.swipeText}>Recalled</Text>
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
            activeOpacity={0.7}
            style={styles.cardInner}
          >
            <View
              style={[
                styles.categoryBar,
                { backgroundColor: category?.color ?? colors.tint },
              ]}
            />
            <View style={styles.content}>
              <View style={styles.topRow}>
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor:
                        (category?.color ?? colors.tint) + '15',
                    },
                  ]}
                >
                  <Ionicons
                    name={(category?.icon as any) ?? 'star-outline'}
                    size={12}
                    color={category?.color ?? colors.tint}
                  />
                  <Text
                    style={[
                      styles.categoryName,
                      { color: category?.color ?? colors.tint },
                    ]}
                  >
                    {category?.name ?? 'Other'}
                  </Text>
                </View>
                <Text style={[styles.intervalText, { color: colors.textTertiary }]}>
                  Day {item.currentInterval}
                </Text>
              </View>

              <Text
                style={[styles.contentText, { color: colors.text }]}
                numberOfLines={2}
              >
                {item.content}
              </Text>

              {item.source ? (
                <Text
                  style={[styles.sourceText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.source}
                </Text>
              ) : null}

              <View style={styles.metaFooter}>
                <PriorityBadge
                  priorityCode={item.priorityCode}
                  priorityLabel={item.priorityLabel}
                  compact
                />
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textTertiary}
              style={styles.chevron}
            />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 10,
    position: 'relative',
  },
  swipeBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 24,
    gap: 8,
  },
  swipeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
  },
  categoryBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600',
  },
  intervalText: {
    fontSize: 12,
    fontWeight: '500',
  },
  contentText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  sourceText: {
    fontSize: 13,
    marginTop: 4,
  },
  metaFooter: {
    marginTop: 8,
  },
  chevron: {
    paddingRight: 12,
  },
});
