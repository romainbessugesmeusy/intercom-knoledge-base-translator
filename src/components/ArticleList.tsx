import { useState, useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  getCoreRowModel,
  HeaderGroup,
  Header,
  Row,
  Cell,
} from '@tanstack/react-table';
import type { IntercomArticle } from '../types';

interface Props {
  articles: IntercomArticle[];
  selectedLanguage: string;
  onArticleClick: (article: IntercomArticle) => void;
  onTranslateSelected: (articles: IntercomArticle[]) => void;
  onRefreshSelected: () => Promise<void>;
}

export default function ArticleList({
  articles,
  selectedLanguage,
  onArticleClick,
  onTranslateSelected,
  onRefreshSelected,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const columnHelper = createColumnHelper<IntercomArticle>();

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={selectedIds.length === articles.length && articles.length > 0}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds(articles.map(a => a.id));
              } else {
                setSelectedIds([]);
              }
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.includes(row.original.id)}
            onClick={e => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds(prev => [...prev, row.original.id]);
              } else {
                setSelectedIds(prev => prev.filter(id => id !== row.original.id));
              }
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: ({ row }) => (
          <button
            onClick={() => onArticleClick(row.original)}
            className="text-blue-600 hover:text-blue-800 hover:underline text-left max-w-xs whitespace-normal break-words"
          >
            {row.original.title}
          </button>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: 'Created At',
        cell: info => new Date(info.getValue() * 1000).toLocaleString(),
      }),
      columnHelper.accessor('updated_at', {
        header: 'Updated At',
        cell: info => new Date(info.getValue() * 1000).toLocaleString(),
      }),
      columnHelper.accessor('state', {
        header: 'State',
        cell: info => (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            info.getValue() === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('translated_content', {
        id: 'translatedState',
        header: 'Translated State',
        cell: info => {
          const translatedContent = info.row.original.translated_content;
          const langKeys = Object.keys(translatedContent).filter(key => key !== 'type');
          
          let state = 'untranslated';
          // Try exact match first
          if (langKeys.includes(selectedLanguage)) {
            state = translatedContent[selectedLanguage].state;
          } else {
            // Try partial match (e.g., 'pt' matches 'pt-BR')
            const match = langKeys.find(key => key.startsWith(selectedLanguage));
            if (match) {
              state = translatedContent[match].state;
            }
          }

          let stateClass = '';
          switch (state) {
            case 'published':
              stateClass = 'bg-green-100 text-green-800';
              break;
            case 'draft':
              stateClass = 'bg-yellow-100 text-yellow-800';
              break;
            default:
              stateClass = 'bg-gray-100 text-gray-800';
          }

          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stateClass}`}>
              {state}
            </span>
          );
        },
      }),
    ],
    [selectedLanguage, articles, selectedIds]
  );

  const selectedArticles = articles.filter(a => selectedIds.includes(a.id));

  const table = useReactTable({
    data: articles,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Articles</h2>
        {selectedArticles.length > 0 && (
          <div className="flex space-x-2">
            <button
              onClick={onRefreshSelected}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
            >
              Refresh Selected
            </button>
            <button
              onClick={() => onTranslateSelected(selectedArticles)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
            >
              Translate Selected
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup: HeaderGroup<IntercomArticle>) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header: Header<IntercomArticle, unknown>) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row: Row<IntercomArticle>) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onArticleClick(row.original)}
              >
                {row.getVisibleCells().map((cell: Cell<IntercomArticle, unknown>) => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 