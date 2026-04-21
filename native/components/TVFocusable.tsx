import { useState, useRef } from "react";
import {
  TouchableOpacity,
  Platform,
  StyleSheet,
  type ViewStyle,
} from "react-native";

interface TVFocusableProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
  focusStyle?: ViewStyle;
}

/**
 * A wrapper that highlights on focus for TV remote/d-pad navigation.
 * On mobile/web it behaves like a normal TouchableOpacity.
 */
export default function TVFocusable({
  children,
  onPress,
  style,
  focusStyle,
}: TVFocusableProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TouchableOpacity
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      activeOpacity={0.8}
      style={[
        style,
        focused && (focusStyle ?? styles.defaultFocus),
      ]}
      // @ts-expect-error — hasTVPreferredFocus exists on tvOS only
      hasTVPreferredFocus={false}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  defaultFocus: {
    borderColor: "#7c5cfc",
    borderWidth: 2,
    shadowColor: "#7c5cfc",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
