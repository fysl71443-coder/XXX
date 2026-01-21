/**
 * VirtualList Component
 * High-performance virtualized list for rendering large datasets
 * Uses react-window for efficient DOM rendering
 */

import { FixedSizeList, VariableSizeList } from 'react-window';
import { useRef, useCallback, memo } from 'react';

/**
 * Simple virtualized list for items of fixed height
 * 
 * @example
 * <VirtualList
 *   items={data}
 *   height={600}
 *   itemHeight={50}
 *   renderItem={(item, index) => <div>{item.name}</div>}
 * />
 */
export function VirtualList({ 
  items = [], 
  height = 400, 
  width = '100%',
  itemHeight = 50,
  renderItem,
  className = '',
  overscanCount = 5,
  emptyMessage = 'لا توجد بيانات',
}) {
  if (!items || items.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-500 ${className}`} style={{ height }}>
        {emptyMessage}
      </div>
    );
  }

  const Row = memo(({ index, style }) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  ));

  return (
    <FixedSizeList
      height={height}
      width={width}
      itemCount={items.length}
      itemSize={itemHeight}
      overscanCount={overscanCount}
      className={className}
    >
      {Row}
    </FixedSizeList>
  );
}

/**
 * Virtualized table for displaying tabular data efficiently
 * 
 * @example
 * <VirtualTable
 *   columns={[
 *     { key: 'name', header: 'الاسم', width: 200 },
 *     { key: 'phone', header: 'الهاتف', width: 150 },
 *   ]}
 *   data={customers}
 *   height={500}
 *   rowHeight={48}
 * />
 */
export function VirtualTable({
  columns = [],
  data = [],
  height = 400,
  rowHeight = 48,
  headerHeight = 48,
  className = '',
  onRowClick,
  selectedId,
  emptyMessage = 'لا توجد بيانات',
}) {
  const totalWidth = columns.reduce((sum, col) => sum + (col.width || 150), 0);

  if (!data || data.length === 0) {
    return (
      <div className={`border rounded-lg overflow-hidden ${className}`}>
        {/* Header */}
        <div 
          className="flex bg-gray-100 border-b font-medium text-gray-700"
          style={{ height: headerHeight }}
        >
          {columns.map((col) => (
            <div 
              key={col.key} 
              className="flex items-center px-3 border-r last:border-r-0"
              style={{ width: col.width || 150, minWidth: col.width || 150 }}
            >
              {col.header}
            </div>
          ))}
        </div>
        {/* Empty state */}
        <div className="flex items-center justify-center text-gray-500 py-10">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const Row = memo(({ index, style }) => {
    const item = data[index];
    const isSelected = selectedId && item.id === selectedId;
    
    return (
      <div 
        style={style}
        className={`flex border-b hover:bg-gray-50 cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50' : ''
        }`}
        onClick={() => onRowClick && onRowClick(item, index)}
      >
        {columns.map((col) => (
          <div 
            key={col.key}
            className="flex items-center px-3 border-r last:border-r-0 truncate"
            style={{ width: col.width || 150, minWidth: col.width || 150 }}
            title={col.render ? undefined : String(item[col.key] || '')}
          >
            {col.render ? col.render(item[col.key], item, index) : (item[col.key] ?? '-')}
          </div>
        ))}
      </div>
    );
  });

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div 
        className="flex bg-gray-100 border-b font-medium text-gray-700"
        style={{ height: headerHeight, minWidth: totalWidth }}
      >
        {columns.map((col) => (
          <div 
            key={col.key} 
            className="flex items-center px-3 border-r last:border-r-0"
            style={{ width: col.width || 150, minWidth: col.width || 150 }}
          >
            {col.header}
          </div>
        ))}
      </div>
      
      {/* Body */}
      <FixedSizeList
        height={height - headerHeight}
        width="100%"
        itemCount={data.length}
        itemSize={rowHeight}
        overscanCount={5}
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}

/**
 * Virtualized list with variable item heights
 * Use when items have different heights
 */
export function VariableVirtualList({
  items = [],
  height = 400,
  width = '100%',
  getItemHeight,
  renderItem,
  className = '',
  overscanCount = 3,
  emptyMessage = 'لا توجد بيانات',
}) {
  const listRef = useRef(null);

  // Default height estimator
  const getSize = useCallback((index) => {
    if (getItemHeight) {
      return getItemHeight(items[index], index);
    }
    return 60; // Default height
  }, [items, getItemHeight]);

  if (!items || items.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-500 ${className}`} style={{ height }}>
        {emptyMessage}
      </div>
    );
  }

  const Row = memo(({ index, style }) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  ));

  return (
    <VariableSizeList
      ref={listRef}
      height={height}
      width={width}
      itemCount={items.length}
      itemSize={getSize}
      overscanCount={overscanCount}
      className={className}
    >
      {Row}
    </VariableSizeList>
  );
}

/**
 * Simple wrapper for conditionally using virtual list
 * Falls back to regular rendering for small datasets
 */
export function SmartList({
  items = [],
  threshold = 50, // Use virtual list if items > threshold
  height = 400,
  itemHeight = 50,
  renderItem,
  className = '',
  emptyMessage = 'لا توجد بيانات',
}) {
  // Use regular rendering for small datasets
  if (items.length <= threshold) {
    if (items.length === 0) {
      return (
        <div className={`flex items-center justify-center text-gray-500 py-8 ${className}`}>
          {emptyMessage}
        </div>
      );
    }
    
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={item.id || index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // Use virtual list for large datasets
  return (
    <VirtualList
      items={items}
      height={height}
      itemHeight={itemHeight}
      renderItem={renderItem}
      className={className}
      emptyMessage={emptyMessage}
    />
  );
}

export default VirtualList;
