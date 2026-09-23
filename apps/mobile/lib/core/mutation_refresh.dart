sealed class MutationOutcome {
  const MutationOutcome();
}

class MutationCommitted extends MutationOutcome {
  const MutationCommitted();
}

class MutationRejected extends MutationOutcome {
  const MutationRejected(this.message);
  final String message;
}

Future<MutationOutcome> runMutation(
  Future<void> Function() mutate, {
  required String Function(Object error) errorMessage,
}) async {
  try {
    await mutate();
    return const MutationCommitted();
  } catch (error) {
    return MutationRejected(errorMessage(error));
  }
}
