import React from 'react';
import { Platform, Pressable } from 'react-native';
import { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderScreen } from '@/dev/testkit';
import { DraggableSessionFolderHeaderFrame } from './DraggableSessionFolderHeaderFrame';
import { ProjectGroupHeader } from './ProjectGroupHeader';
import type { SessionListViewItem } from '@/sync/domains/state/storage';
import type { TreeDropOverlaySharedValues } from '@/components/ui/treeDragDrop';
import type { UseSessionInlineDragResolvedDrop } from './useSessionInlineDrag';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', async () => {
    const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
    return createReactNativeWebMock();
});
vi.mock('react-native-unistyles', async () => {
    const { createUnistylesMock } = await import('@/dev/testkit/mocks/unistyles');
    return createUnistylesMock();
});
vi.mock('react-native-reanimated', async () => {
    const { createReanimatedModuleMock } = await import('@/dev/testkit/mocks/reanimated');
    return createReanimatedModuleMock();
});
vi.mock('react-native-gesture-handler', async () => {
    const { createGestureHandlerMock } = await import('@/dev/testkit/mocks/gestureHandler');
    return createGestureHandlerMock();
});
vi.mock('react-native-worklets', () => ({
    scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
vi.mock('expo-image', () => ({
    Image: (props: Record<string, unknown>) => React.createElement('ExpoImage', props),
}));
vi.mock('@hugeicons/react-native', () => ({
    HugeiconsIcon: (props: Record<string, unknown>) => React.createElement('HugeiconsIcon', props),
}));
vi.mock('@/text', async () => {
    const { createTextModuleMock } = await import('@/dev/testkit/mocks/text');
    return createTextModuleMock({ translate: (key) => key });
});
vi.mock('@/components/ui/forms/dropdown/DropdownMenu', () => ({
    DropdownMenu: (props: Record<string, unknown> & { trigger?: (state: { toggle: () => void }) => React.ReactNode }) => (
        React.createElement('DropdownMenu', props, typeof props.trigger === 'function' ? props.trigger({ toggle: () => {} }) : null)
    ),
}));

const headerItem = {
    type: 'header',
    headerKind: 'project',
    title: '~/repo',
    groupKey: 'server:s1:project:w1',
    workspaceKey: 'w1',
    serverId: 's1',
    workspaceScopeHint: { serverId: 's1', machineId: 'm1', rootPath: '/repo' },
    seedSessionId: null,
    machine: { id: 'm1' },
} as unknown as Extract<SessionListViewItem, { type: 'header' }>;

type TestNode = { type?: unknown; parent?: TestNode | null };

/** Walks up from a node and reports whether a GestureDetector wraps it. */
function isInsideDetector(start: TestNode): boolean {
    let current: TestNode | null = start;
    while (current) {
        if (current.type === 'GestureDetector') return true;
        current = current.parent ?? null;
    }
    return false;
}

async function renderProjectHeaderOnNative() {
    const overlayShared: TreeDropOverlaySharedValues = {
        overlayVisible: { value: 0 }, overlayKind: { value: 0 },
        overlayTop: { value: 0 }, overlayHeight: { value: 0 },
        overlayLeft: { value: 0 }, overlayRight: { value: 0 }, overlayDepth: { value: 0 },
    };
    const resolved: UseSessionInlineDragResolvedDrop = {
        result: { instruction: { kind: 'idle' }, visual: { kind: 'none' } },
        geometry: { kind: 'none' },
        destinationKey: null,
    };
    const onCreateSession = vi.fn();
    const onToggleCollapse = vi.fn();
    const screen = await renderScreen(
        <DraggableSessionFolderHeaderFrame
            dragKey="workspace:w1"
            groupKey="server:s1:project:w1"
            treeRowId="workspace:w1"
            dataIndex={0}
            overlayShared={overlayShared}
            onDragStart={() => {}}
            resolveDropResult={() => resolved}
            onDropResult={() => {}}
            onDragCancel={() => {}}
            onRegisterTreeRowBounds={() => {}}
            onUnregisterTreeRowBounds={() => {}}
        >
            {(gesture) => (
                <ProjectGroupHeader
                    item={headerItem}
                    hasMultipleMachines={false}
                    workspaceLabelsV1={{}}
                    dragHandleGesture={gesture}
                    onRenameWorkspace={() => {}}
                    onResetWorkspaceName={() => {}}
                    onCreateSession={onCreateSession}
                    onAddFolder={() => {}}
                    collapsed={false}
                    onToggleCollapse={onToggleCollapse}
                    headerTestId="session-list-project-header:server:s1:project:w1"
                />
            )}
        </DraggableSessionFolderHeaderFrame>,
    );
    return { screen, onCreateSession, onToggleCollapse };
}

const MENU_TRIGGER_TEST_ID = 'session-workspace-menu-trigger:server:s1:project:w1';
const GRIP_TEST_ID = 'session-workspace-reorder-handle:server:s1:project:w1';
const CONTENT_TEST_ID = 'session-list-project-header:server:s1:project:w1';

describe('ProjectGroupHeader native gesture scope', () => {
    beforeEach(() => { Platform.OS = 'android'; });

    it('keeps the trailing action buttons outside the drag detector (issue #691)', async () => {
        const { screen } = await renderProjectHeaderOnNative();
        const detectors = screen.findAllByType('GestureDetector');
        expect(detectors).toHaveLength(1);
        // The `···` menu trigger, the `+` control and the collapse toggle must
        // not sit inside the drag detector: its activation cancels their
        // presses on Android (#691).
        const menuTrigger = screen.findByTestId(MENU_TRIGGER_TEST_ID);
        const contentPressable = screen.findByTestId(CONTENT_TEST_ID);
        expect(menuTrigger).toBeTruthy();
        expect(contentPressable).toBeTruthy();
        expect(isInsideDetector(menuTrigger!)).toBe(false);
        expect(isInsideDetector(contentPressable!)).toBe(false);
        const plusButton = screen.root.findAllByProps({ accessibilityLabel: 'machine.launchNewSessionInDirectory' })[0];
        expect(plusButton).toBeTruthy();
        expect(isInsideDetector(plusButton!)).toBe(false);
    });

    it('wraps the reorder grip in the drag detector on native', async () => {
        const { screen } = await renderProjectHeaderOnNative();
        const detectors = screen.findAllByType('GestureDetector');
        expect(detectors).toHaveLength(1);
        expect(detectors[0]!.findAllByProps({ testID: GRIP_TEST_ID })).toHaveLength(1);
    });

    it('fires the plus and collapse presses on android', async () => {
        const { screen, onCreateSession, onToggleCollapse } = await renderProjectHeaderOnNative();
        const plusButton = screen.root.findAllByProps({ accessibilityLabel: 'machine.launchNewSessionInDirectory' })[0];
        await act(async () => { plusButton?.props.onPress(); });
        expect(onCreateSession).toHaveBeenCalledOnce();
        await act(async () => { screen.findByTestId(CONTENT_TEST_ID)?.props.onPress(); });
        expect(onToggleCollapse).toHaveBeenCalledOnce();
    });
});
