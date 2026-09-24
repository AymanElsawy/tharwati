enum AppErrorCategory { bootstrap, flutterFramework, platform, zone }

abstract interface class AppErrorReporter {
  void capture(AppErrorCategory category, Object error, StackTrace stackTrace);
}

class NoopAppErrorReporter implements AppErrorReporter {
  const NoopAppErrorReporter();

  @override
  void capture(
    AppErrorCategory category,
    Object error,
    StackTrace stackTrace,
  ) {}
}
