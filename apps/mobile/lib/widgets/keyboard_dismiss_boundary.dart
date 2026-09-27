import 'package:flutter/material.dart';

/// Applies mobile keyboard dismissal without competing with child tap gestures.
/// Text fields invoke this action only for taps outside their own tap region.
class AppKeyboardDismissBoundary extends StatelessWidget {
  const AppKeyboardDismissBoundary({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Actions(
    actions: {
      EditableTextTapOutsideIntent:
          CallbackAction<EditableTextTapOutsideIntent>(
            onInvoke: (intent) {
              intent.focusNode.unfocus();
              return null;
            },
          ),
    },
    child: GestureDetector(
      // A child control wins the tap gesture; this handles only empty surface
      // taps that do not hit a text field's own tap-outside region.
      behavior: HitTestBehavior.translucent,
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      child: NotificationListener<ScrollStartNotification>(
        onNotification: (notification) {
          if (notification.dragDetails != null &&
              notification.context
                      ?.findAncestorWidgetOfExactType<EditableText>() ==
                  null) {
            FocusManager.instance.primaryFocus?.unfocus();
          }
          return false;
        },
        child: child,
      ),
    ),
  );
}
