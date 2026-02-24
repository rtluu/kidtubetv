import { useState, useRef, useCallback, ReactNode } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, borderRadius } from '@src/constants/theme';

interface DraggableListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const isWeb = Platform.OS === 'web';

export default function DraggableList<T>({
  items,
  keyExtractor,
  renderItem,
  onReorder,
}: DraggableListProps<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0) onReorder(index, index - 1);
    },
    [onReorder]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < items.length - 1) onReorder(index, index + 1);
    },
    [onReorder, items.length]
  );

  return (
    <View>
      {items.map((item, index) => {
        const key = keyExtractor(item);
        const isDragging = dragIndex === index;
        const isDropTarget = dropTarget === index;

        if (isWeb) {
          // Use raw divs on web for HTML5 drag-and-drop support
          return (
            // @ts-ignore - div is valid on web
            <div
              key={key}
              style={{
                display: 'flex',
                flexDirection: 'row' as const,
                alignItems: 'center',
                backgroundColor: colors.background,
                borderRadius: borderRadius.sm,
                marginBottom: spacing.sm,
                borderWidth: 2,
                borderStyle: 'solid' as const,
                borderColor: isDropTarget ? colors.crtBlue : 'transparent',
                opacity: isDragging ? 0.4 : 1,
              }}
              onDragOver={(e: React.DragEvent) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(index);
              }}
              onDragLeave={() => {
                setDropTarget((prev) => (prev === index ? null : prev));
              }}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault();
                const from = dragIndexRef.current;
                if (from !== null && from !== index) {
                  onReorder(from, index);
                }
                setDragIndex(null);
                setDropTarget(null);
                dragIndexRef.current = null;
              }}
            >
              {/* Drag handle */}
              {/* @ts-ignore */}
              <div
                draggable
                style={{
                  padding: spacing.sm,
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onDragStart={(e: React.DragEvent) => {
                  dragIndexRef.current = index;
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropTarget(null);
                  dragIndexRef.current = null;
                }}
              >
                <FontAwesome name="bars" size={14} color={colors.textSecondary} />
              </div>

              {/* Item content */}
              {/* @ts-ignore */}
              <div style={{ flex: 1 }}>
                {renderItem(item, index)}
              </div>
            </div>
          );
        }

        // Native: up/down arrow buttons
        return (
          <View
            key={key}
            style={[
              styles.itemRow,
              isDragging && styles.itemDragging,
              isDropTarget && styles.itemDropTarget,
            ]}
          >
            <View style={styles.arrowButtons}>
              <Pressable
                onPress={() => handleMoveUp(index)}
                disabled={index === 0}
                style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
              >
                <FontAwesome name="chevron-up" size={10} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => handleMoveDown(index)}
                disabled={index === items.length - 1}
                style={[styles.arrowBtn, index === items.length - 1 && styles.arrowBtnDisabled]}
              >
                <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.itemContent}>{renderItem(item, index)}</View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemDragging: {
    opacity: 0.4,
  },
  itemDropTarget: {
    borderColor: colors.crtBlue,
  },
  arrowButtons: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  arrowBtn: {
    padding: 4,
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  itemContent: {
    flex: 1,
  },
});
