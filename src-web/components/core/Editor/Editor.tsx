import { defaultKeymap, historyField, indentWithTab } from '@codemirror/commands';
import { foldState, forceParsing } from '@codemirror/language';
import type { EditorStateConfig, Extension } from '@codemirror/state';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExt, tooltips } from '@codemirror/view';
import { emacs } from '@replit/codemirror-emacs';
import { vim } from '@replit/codemirror-vim';

import { vscodeKeymap } from '@replit/codemirror-vscode-keymap';
import type { EditorKeymap, EnvironmentVariable } from '@yaakapp-internal/models';
import { settingsAtom } from '@yaakapp-internal/models';
import type { EditorLanguage, TemplateFunction } from '@yaakapp-internal/plugins';
import { parseTemplate } from '@yaakapp-internal/templates';
import classNames from 'classnames';
import type { GraphQLSchema } from 'graphql';
import { useAtomValue } from 'jotai';
import { md5 } from 'js-md5';
import type { ReactNode, RefObject } from 'react';
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { activeEnvironmentIdAtom } from '../../../hooks/useActiveEnvironment';
import { useEnvironmentVariables } from '../../../hooks/useEnvironmentVariables';
import { useRequestEditor } from '../../../hooks/useRequestEditor';
import { useTemplateFunctionCompletionOptions } from '../../../hooks/useTemplateFunctions';
import { showDialog } from '../../../lib/dialog';
import { tryFormatJson, tryFormatXml } from '../../../lib/formatters';
import { withEncryptionEnabled } from '../../../lib/setupOrConfigureEncryption';
import { TemplateFunctionDialog } from '../../TemplateFunctionDialog';
import { TemplateVariableDialog } from '../../TemplateVariableDialog';
import { IconButton } from '../IconButton';
import { InlineCode } from '../InlineCode';
import { HStack } from '../Stacks';
import './Editor.css';
import {
  baseExtensions,
  getLanguageExtension,
  multiLineExtensions,
  readonlyExtensions,
} from './extensions';
import type { GenericCompletionConfig } from './genericCompletion';
import { singleLineExtensions } from './singleLine';

// VSCode's Tab actions mess with the single-line editor tab actions, so remove it.
const vsCodeWithoutTab = vscodeKeymap.filter((k) => k.key !== 'Tab');

const keymapExtensions: Record<EditorKeymap, Extension> = {
  vim: vim(),
  emacs: emacs(),
  vscode: keymap.of(vsCodeWithoutTab),
  default: [],
};

export interface EditorProps {
  actions?: ReactNode;
  autoFocus?: boolean;
  autoSelect?: boolean;
  autocomplete?: GenericCompletionConfig;
  autocompleteFunctions?: boolean;
  autocompleteVariables?: boolean;
  className?: string;
  defaultValue?: string | null;
  disableTabIndent?: boolean;
  disabled?: boolean;
  extraExtensions?: Extension[];
  forcedEnvironmentId?: string;
  forceUpdateKey?: string | number;
  format?: (v: string) => Promise<string>;
  heightMode?: 'auto' | 'full';
  hideGutter?: boolean;
  id?: string;
  language?: EditorLanguage | 'pairs' | 'url';
  graphQLSchema?: GraphQLSchema | null;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onPaste?: (value: string) => void;
  onPasteOverwrite?: (e: ClipboardEvent, value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  singleLine?: boolean;
  stateKey: string | null;
  tooltipContainer?: HTMLElement;
  type?: 'text' | 'password';
  wrapLines?: boolean;
}

const stateFields = { history: historyField, folds: foldState };

const emptyVariables: EnvironmentVariable[] = [];
const emptyExtension: Extension = [];

// 翻译搜索面板函数
function translateSearchPanel(panel: HTMLElement): void {
  // 翻译输入框placeholder
  const findInput = panel.querySelector('input[placeholder="Find"]');
  const replaceInput = panel.querySelector('input[placeholder="Replace"]');

  if (findInput) (findInput as HTMLInputElement).placeholder = "查找";
  if (replaceInput) (replaceInput as HTMLInputElement).placeholder = "替换";

  // 翻译按钮文本
  panel.querySelectorAll('button.cm-button').forEach((button) => {
    const buttonElement = button as HTMLButtonElement;
    const name = buttonElement.textContent?.trim().toLowerCase().replace("\"","")
    console.log(name)
    switch (name) {
      case 'next':
        buttonElement.textContent = '下一个';
        break;
      case 'previous':
        buttonElement.textContent = '上一个';
        break;
      case 'all':
        buttonElement.textContent = '全部';
        break;
      case 'replace':
        buttonElement.textContent = '替换';
        break;
      case 'replace all':
        buttonElement.textContent = '全部替换';
        break;
      case 'close':
        buttonElement.textContent = '关闭';
        break;
      default:
        break;
    }
  });

  // 翻译标签文本
  panel.querySelectorAll('label').forEach((label) => {
    const input = label.querySelector('input');
    if (input) {
      const inputName = input.getAttribute('name');
      let textContent = '';

      switch (inputName) {
        case 'case':
          textContent = '区分大小写';
          break;
        case 're':
          textContent = '正则表达式';
          break;
        case 'word':
          textContent = '全词匹配';
          break;
        default:
          return;
      }

      // 创建新的文本节点
      const textNode = document.createTextNode(textContent);

      // 清空label并重新添加input和文本
      label.innerHTML = '';
      label.appendChild(input);
      label.appendChild(textNode);
    }
  });

  // 标记已翻译
  panel.dataset.translated = 'true';
}

// 监听搜索面板的创建
function setupSearchPanelListener() {
  // 使用MutationObserver监听DOM变化
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          const element = node as HTMLElement;
          if (element.classList.contains('cm-search') &&
            element.classList.contains('cm-panel') &&
            !element.dataset.translated) {
            // 立即翻译
            translateSearchPanel(element);

            // 监听面板内部的变化（可能动态添加内容）
            const panelObserver = new MutationObserver(() => {
              if (!element.dataset.translated) {
                translateSearchPanel(element);
              }
            });

            panelObserver.observe(element, {
              childList: true,
              subtree: true,
              characterData: true
            });
          }
        }
      }
    }
  });

  // 开始观察整个document
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return observer;
}


export const Editor = forwardRef<EditorView | undefined, EditorProps>(function Editor(
  {
    actions,
    autoFocus,
    autoSelect,
    autocomplete,
    autocompleteFunctions,
    autocompleteVariables,
    className,
    defaultValue,
    disableTabIndent,
    disabled,
    extraExtensions,
    forcedEnvironmentId,
    forceUpdateKey,
    format,
    heightMode,
    hideGutter,
    graphQLSchema,
    language,
    onBlur,
    onChange,
    onFocus,
    onKeyDown,
    onPaste,
    onPasteOverwrite,
    placeholder,
    readOnly,
    singleLine,
    stateKey,
    type,
    wrapLines,
  }: EditorProps,
  ref,
) {
  const settings = useAtomValue(settingsAtom);

  const activeEnvironmentId = useAtomValue(activeEnvironmentIdAtom);
  const environmentId = forcedEnvironmentId ?? activeEnvironmentId ?? null;
  const allEnvironmentVariables = useEnvironmentVariables(environmentId);
  const environmentVariables = autocompleteVariables ? allEnvironmentVariables : emptyVariables;
  const useTemplating = !!(autocompleteFunctions || autocompleteVariables || autocomplete);

  if (settings && wrapLines === undefined) {
    wrapLines = settings.editorSoftWrap;
  }

  if (disabled) {
    readOnly = true;
  }

  if (
    singleLine ||
    language == null ||
    language === 'text' ||
    language === 'url' ||
    language === 'pairs'
  ) {
    disableTabIndent = true;
  }

  if (format == null && !readOnly) {
    format =
      language === 'json'
        ? tryFormatJson
        : language === 'xml' || language === 'html'
          ? tryFormatXml
          : undefined;
  }

  const cm = useRef<{ view: EditorView; languageCompartment: Compartment } | null>(null);
  useImperativeHandle(ref, () => cm.current?.view, []);

  // 设置搜索面板监听
  useEffect(() => {
    const observer = setupSearchPanelListener();

    // 立即检查是否已经有搜索面板存在（可能在组件挂载前就已经打开）
    const existingPanels = document.querySelectorAll('.cm-search.cm-panel');
    existingPanels.forEach(panel => {
      if (!(panel as HTMLElement).dataset.translated) {
        translateSearchPanel(panel as HTMLElement);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Use ref so we can update the handler without re-initializing the editor
  const handleChange = useRef<EditorProps['onChange']>(onChange);
  useEffect(() => {
    handleChange.current = onChange;
  }, [onChange]);

  // Use ref so we can update the handler without re-initializing the editor
  const handlePaste = useRef<EditorProps['onPaste']>(onPaste);
  useEffect(() => {
    handlePaste.current = onPaste;
  }, [onPaste]);

  // Use ref so we can update the handler without re-initializing the editor
  const handlePasteOverwrite = useRef<EditorProps['onPasteOverwrite']>(onPasteOverwrite);
  useEffect(() => {
    handlePasteOverwrite.current = onPasteOverwrite;
  }, [onPasteOverwrite]);

  // Use ref so we can update the handler without re-initializing the editor
  const handleFocus = useRef<EditorProps['onFocus']>(onFocus);
  useEffect(() => {
    handleFocus.current = onFocus;
  }, [onFocus]);

  // Use ref so we can update the handler without re-initializing the editor
  const handleBlur = useRef<EditorProps['onBlur']>(onBlur);
  useEffect(() => {
    handleBlur.current = onBlur;
  }, [onBlur]);

  // Use ref so we can update the handler without re-initializing the editor
  const handleKeyDown = useRef<EditorProps['onKeyDown']>(onKeyDown);
  useEffect(() => {
    handleKeyDown.current = onKeyDown;
  }, [onKeyDown]);

  // Update placeholder
  const placeholderCompartment = useRef(new Compartment());
  useEffect(
    function configurePlaceholder() {
      if (cm.current === null) return;
      const ext = placeholderExt(placeholderElFromText(placeholder));
      const effects = placeholderCompartment.current.reconfigure(ext);
      cm.current?.view.dispatch({ effects });
    },
    [placeholder, type],
  );

  // Update vim
  const keymapCompartment = useRef(new Compartment());
  useEffect(
    function configureKeymap() {
      if (cm.current === null) return;
      const current = keymapCompartment.current.get(cm.current.view.state) ?? [];
      // PERF: This is expensive with hundreds of editors on screen, so only do it when necessary
      if (settings.editorKeymap === 'default' && current === keymapExtensions['default']) return; // Nothing to do
      if (settings.editorKeymap === 'vim' && current === keymapExtensions['vim']) return; // Nothing to do
      if (settings.editorKeymap === 'vscode' && current === keymapExtensions['vscode']) return; // Nothing to do
      if (settings.editorKeymap === 'emacs' && current === keymapExtensions['emacs']) return; // Nothing to do

      const ext = keymapExtensions[settings.editorKeymap] ?? keymapExtensions['default'];
      const effects = keymapCompartment.current.reconfigure(ext);
      cm.current.view.dispatch({ effects });
    },
    [settings.editorKeymap],
  );

  // Update wrap lines
  const wrapLinesCompartment = useRef(new Compartment());
  useEffect(
    function configureWrapLines() {
      if (cm.current === null) return;
      const current = wrapLinesCompartment.current.get(cm.current.view.state) ?? emptyExtension;
      // PERF: This is expensive with hundreds of editors on screen, so only do it when necessary
      if (wrapLines && current !== emptyExtension) return; // Nothing to do
      if (!wrapLines && current === emptyExtension) return; // Nothing to do

      const ext = wrapLines ? EditorView.lineWrapping : emptyExtension;
      const effects = wrapLinesCompartment.current.reconfigure(ext);
      cm.current?.view.dispatch({ effects });
    },
    [wrapLines],
  );

  // Update tab indent
  const tabIndentCompartment = useRef(new Compartment());
  useEffect(
    function configureTabIndent() {
      if (cm.current === null) return;
      const current = tabIndentCompartment.current.get(cm.current.view.state) ?? emptyExtension;
      // PERF: This is expensive with hundreds of editors on screen, so only do it when necessary
      if (disableTabIndent && current !== emptyExtension) return; // Nothing to do
      if (!disableTabIndent && current === emptyExtension) return; // Nothing to do

      const ext = !disableTabIndent ? keymap.of([indentWithTab]) : emptyExtension;
      const effects = tabIndentCompartment.current.reconfigure(ext);
      cm.current?.view.dispatch({ effects });
    },
    [disableTabIndent],
  );

  const onClickFunction = useCallback(
    async (fn: TemplateFunction, tagValue: string, startPos: number) => {
      const initialTokens = parseTemplate(tagValue);
      const show = () =>
        showDialog({
          id: 'template-function-' + Math.random(), // Allow multiple at once
          size: 'md',
          title: <InlineCode>{fn.name}(…)</InlineCode>,
          description: fn.description,
          render: ({ hide }) => (
            <TemplateFunctionDialog
              templateFunction={fn}
              hide={hide}
              initialTokens={initialTokens}
              onChange={(insert) => {
                cm.current?.view.dispatch({
                  changes: [{ from: startPos, to: startPos + tagValue.length, insert }],
                });
              }}
            />
          ),
        });

      if (fn.name === 'secure') {
        withEncryptionEnabled(show);
      } else {
        show();
      }
    },
    [],
  );

  const onClickVariable = useCallback(
    async (_v: EnvironmentVariable, tagValue: string, startPos: number) => {
      const initialTokens = parseTemplate(tagValue);
      showDialog({
        size: 'dynamic',
        id: 'template-variable',
        title: 'Change Variable',
        render: ({ hide }) => (
          <TemplateVariableDialog
            hide={hide}
            initialTokens={initialTokens}
            onChange={(insert) => {
              cm.current?.view.dispatch({
                changes: [{ from: startPos, to: startPos + tagValue.length, insert }],
              });
            }}
          />
        ),
      });
    },
    [],
  );

  const onClickMissingVariable = useCallback(
    async (_name: string, tagValue: string, startPos: number) => {
      const initialTokens = parseTemplate(tagValue);
      showDialog({
        size: 'dynamic',
        id: 'template-variable',
        title: 'Configure Variable',
        render: ({ hide }) => (
          <TemplateVariableDialog
            hide={hide}
            initialTokens={initialTokens}
            onChange={(insert) => {
              cm.current?.view.dispatch({
                changes: [{ from: startPos, to: startPos + tagValue.length, insert }],
              });
            }}
          />
        ),
      });
    },
    [],
  );

  const [, { focusParamValue }] = useRequestEditor();
  const onClickPathParameter = useCallback(
    async (name: string) => {
      focusParamValue(name);
    },
    [focusParamValue],
  );

  const completionOptions = useTemplateFunctionCompletionOptions(
    onClickFunction,
    !!autocompleteFunctions,
  );

  // Update the language extension when the language changes
  useEffect(() => {
    if (cm.current === null) return;
    const { view, languageCompartment } = cm.current;
    const ext = getLanguageExtension({
      useTemplating,
      language,
      environmentVariables,
      autocomplete,
      completionOptions,
      onClickVariable,
      onClickMissingVariable,
      onClickPathParameter,
      graphQLSchema: graphQLSchema ?? null,
    });
    view.dispatch({ effects: languageCompartment.reconfigure(ext) });
  }, [
    language,
    autocomplete,
    environmentVariables,
    onClickFunction,
    onClickVariable,
    onClickMissingVariable,
    onClickPathParameter,
    completionOptions,
    useTemplating,
    graphQLSchema,
  ]);

  const fontSizeCompartment = useRef(new Compartment());
  useEffect(() => {
    if (!cm.current) return;
    const size = Number(settings.editorFontSize) || 14;
    const ext = EditorView.theme({
      ".cm-content": {
        fontSize: `${size}px`
      }
    });
    const effects = fontSizeCompartment.current.reconfigure(ext);
    cm.current.view.dispatch({ effects });
  }, [settings.editorFontSize]);

  // Initialize the editor when ref mounts
  const initEditorRef = useCallback(
    function initEditorRef(container: HTMLDivElement | null) {
      if (container === null) {
        cm.current?.view.destroy();
        cm.current = null;
        return;
      }

      try {
        const languageCompartment = new Compartment();
        const langExt = getLanguageExtension({
          useTemplating,
          language,
          completionOptions,
          autocomplete,
          environmentVariables,
          onClickVariable,
          onClickMissingVariable,
          onClickPathParameter,
          graphQLSchema: graphQLSchema ?? null,
        });
        const extensions = [
          fontSizeCompartment.current.of(
            EditorView.theme({
              ".cm-content": {
                fontSize: `${Number(settings.editorFontSize) || 13}px`
              }
            })
          ),
          languageCompartment.of(langExt),
          placeholderCompartment.current.of(placeholderExt(placeholderElFromText(placeholder))),
          wrapLinesCompartment.current.of(wrapLines ? EditorView.lineWrapping : emptyExtension),
          tabIndentCompartment.current.of(
            !disableTabIndent ? keymap.of([indentWithTab]) : emptyExtension,
          ),
          keymapCompartment.current.of(
            keymapExtensions[settings.editorKeymap] ?? keymapExtensions['default'],
          ),
          ...getExtensions({
            container,
            readOnly,
            singleLine,
            hideGutter,
            stateKey,
            onChange: handleChange,
            onPaste: handlePaste,
            onPasteOverwrite: handlePasteOverwrite,
            onFocus: handleFocus,
            onBlur: handleBlur,
            onKeyDown: handleKeyDown,
          }),
          ...(extraExtensions ?? []),
        ];

        const cachedJsonState = getCachedEditorState(defaultValue ?? '', stateKey);

        const doc = `${defaultValue ?? ''}`;
        const config: EditorStateConfig = { extensions, doc };

        const state = cachedJsonState
          ? EditorState.fromJSON(cachedJsonState, config, stateFields)
          : EditorState.create(config);

        const view = new EditorView({ state, parent: container });

        setTimeout(() => {
          const panels = document.querySelectorAll('.cm-search.cm-panel');
          panels.forEach(panel => {
            if (!(panel as HTMLElement).dataset.translated) {
              translateSearchPanel(panel as HTMLElement);
            }
          });
        }, 100);

        // For large documents, the parser may parse the max number of lines and fail to add
        // things like fold markers because of it.
        // This forces it to parse more but keeps the timeout to the default of 100 ms.
        forceParsing(view, 9e6, 100);

        cm.current = { view, languageCompartment };
        if (autoFocus) {
          view.focus();
        }
        if (autoSelect) {
          view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
        }
      } catch (e) {
        console.log('Failed to initialize Codemirror', e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forceUpdateKey],
  );

  // For read-only mode, update content when `defaultValue` changes
  useEffect(
    function updateReadOnlyEditor() {
      if (!readOnly || cm.current?.view == null || defaultValue == null) return;

      // Replace codemirror contents
      const currentDoc = cm.current.view.state.doc.toString();
      if (defaultValue.startsWith(currentDoc)) {
        // If we're just appending, append only the changes. This preserves
        // things like scroll position.
        cm.current.view.dispatch({
          changes: cm.current.view.state.changes({
            from: currentDoc.length,
            insert: defaultValue.slice(currentDoc.length),
          }),
        });
      } else {
        // If we're replacing everything, reset the entire content
        cm.current.view.dispatch({
          changes: cm.current.view.state.changes({
            from: 0,
            to: currentDoc.length,
            insert: defaultValue,
          }),
        });
      }
    },
    [defaultValue, readOnly],
  );

  // Add bg classes to actions, so they appear over the text
  const decoratedActions = useMemo(() => {
    const results = [];
    const actionClassName = classNames(
      'bg-surface transition-opacity transform-gpu opacity-0 group-hover:opacity-100 hover:!opacity-100 shadow',
    );

    if (format) {
      results.push(
        <IconButton
          showConfirm
          key="format"
          size="sm"
          title="Reformat contents"
          icon="magic_wand"
          variant="border"
          className={classNames(actionClassName)}
          onClick={async () => {
            if (cm.current === null) return;
            const { doc } = cm.current.view.state;
            const formatted = await format(doc.toString());
            // Update editor and blur because the cursor will reset anyway
            cm.current.view.dispatch({
              changes: { from: 0, to: doc.length, insert: formatted },
            });
            cm.current.view.contentDOM.blur();
            // Fire change event
            onChange?.(formatted);
          }}
        />,
      );
    }
    results.push(
      Children.map(actions, (existingChild) => {
        if (!isValidElement<{ className?: string }>(existingChild)) return null;
        const existingProps = existingChild.props;

        return cloneElement(existingChild, {
          ...existingProps,
          className: classNames(existingProps.className, actionClassName),
        });
      }),
    );
    return results;
  }, [actions, format, onChange]);

  const cmContainer = (
    <div
      ref={initEditorRef}
      className={classNames(
        className,
        'cm-wrapper text-base',
        disabled && 'opacity-disabled',
        type === 'password' && 'cm-obscure-text',
        heightMode === 'auto' ? 'cm-auto-height' : 'cm-full-height',
        singleLine ? 'cm-singleline' : 'cm-multiline',
        readOnly && 'cm-readonly',
      )}
    />
  );

  if (singleLine) {
    return cmContainer;
  }

  return (
    <div className="group relative h-full w-full x-theme-editor bg-surface">
      {cmContainer}
      {decoratedActions && (
        <HStack
          space={1}
          justifyContent="end"
          className={classNames(
            'absolute bottom-2 left-0 right-0',
            'pointer-events-none', // No pointer events, so we don't block the editor
          )}
        >
          {decoratedActions}
        </HStack>
      )}
    </div>
  );
});

function getExtensions({
  stateKey,
  container,
  readOnly,
  singleLine,
  hideGutter,
  onChange,
  onPaste,
  onPasteOverwrite,
  onFocus,
  onBlur,
  onKeyDown,
}: Pick<EditorProps, 'singleLine' | 'readOnly' | 'hideGutter'> & {
  stateKey: EditorProps['stateKey'];
  container: HTMLDivElement | null;
  onChange: RefObject<EditorProps['onChange']>;
  onPaste: RefObject<EditorProps['onPaste']>;
  onPasteOverwrite: RefObject<EditorProps['onPasteOverwrite']>;
  onFocus: RefObject<EditorProps['onFocus']>;
  onBlur: RefObject<EditorProps['onBlur']>;
  onKeyDown: RefObject<EditorProps['onKeyDown']>;
}) {
  // TODO: Ensure tooltips render inside the dialog if we are in one.
  const parent =
    container?.closest<HTMLDivElement>('[role="dialog"]') ??
    document.querySelector<HTMLDivElement>('#cm-portal') ??
    undefined;

  return [
    ...baseExtensions, // Must be first
    EditorView.domEventHandlers({
      focus: () => {
        onFocus.current?.();
      },
      blur: () => {
        onBlur.current?.();
      },
      keydown: (e) => {
        onKeyDown.current?.(e);
      },
      paste: (e, v) => {
        const textData = e.clipboardData?.getData('text/plain') ?? '';
        onPaste.current?.(textData);
        if (v.state.selection.main.from === 0 && v.state.selection.main.to === v.state.doc.length) {
          onPasteOverwrite.current?.(e, textData);
        }
      },
    }),
    tooltips({ parent }),
    keymap.of(singleLine ? defaultKeymap.filter((k) => k.key !== 'Enter') : defaultKeymap),
    ...(singleLine ? [singleLineExtensions()] : []),
    ...(!singleLine ? multiLineExtensions({ hideGutter }) : []),
    ...(readOnly ? readonlyExtensions : []),

    // ------------------------ //
    // Things that must be last //
    // ------------------------ //

    // Fire onChange event
    EditorView.updateListener.of((update) => {
      if (onChange && update.docChanged) {
        onChange.current?.(update.state.doc.toString());
      }
    }),

    // Cache editor state
    EditorView.updateListener.of((update) => {
      saveCachedEditorState(stateKey, update.state);
    }),
  ];
}

const placeholderElFromText = (text: string | undefined) => {
  const el = document.createElement('div');
  // Default to <SPACE> because codemirror needs it for sizing. I'm not sure why, but probably something
  // to do with how Yaak "hacks" it with CSS for single line input.
  el.innerHTML = text ? text.replaceAll('\n', '<br/>') : ' ';
  return el;
};

function saveCachedEditorState(stateKey: string | null, state: EditorState | null) {
  if (!stateKey || state == null) return;
  const stateObj = state.toJSON(stateFields);

  // Save state in sessionStorage by removing doc and saving the hash of it instead.
  // This will be checked on restore and put back in if it matches.
  stateObj.docHash = md5(stateObj.doc);
  delete stateObj.doc;

  try {
    sessionStorage.setItem(computeFullStateKey(stateKey), JSON.stringify(stateObj));
  } catch (err) {
    console.log('Failed to save to editor state', stateKey, err);
  }
}

function getCachedEditorState(doc: string, stateKey: string | null) {
  if (stateKey == null) return;

  try {
    const stateStr = sessionStorage.getItem(computeFullStateKey(stateKey));
    if (stateStr == null) return null;

    const { docHash, ...state } = JSON.parse(stateStr);

    // Ensure the doc matches the one that was used to save the state
    if (docHash !== md5(doc)) {
      return null;
    }

    state.doc = doc;
    return state;
  } catch (err) {
    console.log('Failed to restore editor storage', stateKey, err);
  }

  return null;
}

function computeFullStateKey(stateKey: string): string {
  return `editor.${stateKey}`;
}
