import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/portfolio/portfolio_controller.dart';

import 'portfolio_test_support.dart';

void main() {
  test('slower old scope request cannot overwrite a newer request', () async {
    final loader = QueueLoader();
    final controller = PortfolioController(
      loader: loader,
      changes: ChangeNotifier(),
    );
    final old = controller.load();
    final latest = controller.selectScope('second');
    loader.requests[1].complete(
      source(
        accounts: [account('second')],
        holdings: const [],
        cash: {'second': '2'},
        prices: const {},
      ),
    );
    await latest;
    loader.requests[0].complete(source());
    await old;
    expect(controller.data!.scopeId, 'second');
    expect(controller.data!.currentValueBase, '2');
    controller.dispose();
  });

  test('refresh failure preserves last good data', () async {
    final loader = QueueLoader();
    final controller = PortfolioController(
      loader: loader,
      changes: ChangeNotifier(),
    );
    final first = controller.load();
    loader.requests.single.complete(source());
    await first;
    final good = controller.data;
    final refresh = controller.refresh();
    loader.requests[1].completeError(StateError('offline'));
    await refresh;
    expect(controller.data, same(good));
    expect(controller.status, PortfolioLoadStatus.ready);
    expect(controller.refreshError, isA<StateError>());
    controller.dispose();
  });
}
